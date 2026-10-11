/**
 * Supabase implementation of the access-control repository.
 *
 * ## Paging is not optional here
 *
 * A bare PostgREST `.select()` is capped at the project's `db-max-rows`
 * (1000 by default). This codebase has already been bitten by that once — see
 * `SupabaseMemberRepositoryPaging.test.ts`, where the daily status crons only
 * ever saw the first page of each bucket.
 *
 * The consequence is worse in this feature. A truncated reconcile list is not
 * a slow report; it is members whose access silently never syncs, with nothing
 * anywhere reporting a failure. Every unbounded read below therefore pages with
 * `.range()` until the server returns an empty page.
 *
 * ## Tenant scoping
 *
 * Every method takes identifiers resolved upstream from our own tables under
 * RLS. Nothing here accepts a vendor identifier that arrived on a request, and
 * no query is widened beyond the gym it was given. On a shared vendor account
 * this scoping is the only thing keeping one gym away from another's members
 * and doors.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { ConflictError, DatabaseError, NotFoundError } from '@/utils/errors'
import {
  decryptSecret,
  encryptSecret,
  type AccessCredentials,
} from '@/lib/access-control'
import {
  ACCESS_EVENT_DELETE_CHUNK_SIZE,
  AccessIntent,
  AccessSyncStatus,
  SYNC_RETRY_BACKOFF_SECONDS,
} from '@/features/access-control/config/AccessControlConfig'
import { toCalendarDay } from '@/features/access-control/utils/getGymToday'
import {
  codesForKind,
  type DeviceEventKind,
} from '@/features/access-control/config/DeviceEventCodes'
import type { MemberStatus } from '@/features/members/config/StatusConfig'
import type { RegistrationSource } from '@/features/members/config/RegistrationConfig'
import type {
  AccessControlAccount,
  AccessDevice,
  AccessEvent,
  AccessSyncJob,
  MemberAccessSubject,
} from '@/features/access-control/types'
import type {
  EvictionCandidate,
  IAccessControlRepository,
  IncomingAccessEvent,
  AccessEventWithMember,
  MemberAccessContext,
  SyncStateUpdate,
} from './IAccessControlRepository'

/** Rows fetched per page. Comfortably under the 1000 default cap. */
const PAGE_SIZE = 500

/** Shape of the member columns joined into the access context. */
interface MemberContextRow {
  id: string
  gym_id: string
  name: string
  status: MemberStatus
  membership_start_date: string
  next_due_date: string
  registration_source: RegistrationSource
  verified_at: string | null
  biometric_consent_at: string | null
  member_access_subjects: MemberAccessSubject[] | MemberAccessSubject | null
}

/** Subject ids per member lookup: bounded by the length of a query string. */
const SUBJECT_LOOKUP_CHUNK_SIZE = 100

/** Rows per bulk insert into the outbox. */
const ENQUEUE_CHUNK_SIZE = 500

/**
 * Rows the case-insensitive serial fallback will consider.
 *
 * Serials are globally unique, so a correct system yields at most one. The
 * ceiling exists because `ilike` can over-match through a wildcard character,
 * and an unbounded read of an over-match is a different bug.
 */
const SERIAL_CANDIDATE_LIMIT = 5

export class SupabaseAccessControlRepository implements IAccessControlRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  // ============================================================
  // Account
  // ============================================================

  async findAccountByGymId(
    gymId: string
  ): Promise<AccessControlAccount | null> {
    const { data, error } = await this.supabase
      .from('access_control_accounts')
      .select('*')
      .eq('gym_id', gymId)
      .maybeSingle()

    if (error) {
      throw new DatabaseError(
        `Failed to load access control account: ${error.message}`
      )
    }

    return (data as AccessControlAccount | null) ?? null
  }

  /**
   * Decrypted vendor credentials.
   *
   * `access_control_secrets` has RLS enabled with **no policies**, so this only
   * returns rows for a service-role client. A session client sees nothing —
   * which is the point, since one credential reaches every gym on a shared
   * vendor account. That case reports "not configured" rather than throwing,
   * because it is a permission boundary working correctly, not a fault.
   */
  async getCredentials(gymId: string): Promise<AccessCredentials | null> {
    const account = await this.findAccountByGymId(gymId)
    if (!account || !account.is_active) return null

    const { data, error } = await this.supabase
      .from('access_control_secrets')
      .select('email_ciphertext, password_ciphertext, api_token_ciphertext')
      .eq('account_id', account.id)
      .maybeSingle()

    if (error) {
      throw new DatabaseError(
        `Failed to load access control credentials: ${error.message}`
      )
    }

    if (!data) return null

    const row = data as {
      email_ciphertext: string
      password_ciphertext: string
      api_token_ciphertext: string | null
    }

    return {
      baseUrl: account.base_url,
      email: decryptSecret(row.email_ciphertext),
      password: decryptSecret(row.password_ciphertext),
      apiToken: row.api_token_ciphertext
        ? decryptSecret(row.api_token_ciphertext)
        : null,
      areaId: account.area_id,
    }
  }

  async saveCredentials(
    gymId: string,
    input: {
      baseUrl: string
      email: string
      password: string
      areaId?: number | null
    }
  ): Promise<AccessControlAccount> {
    // Encrypt BEFORE writing anything.
    //
    // A key that cannot be used throws here, and nothing has been stored yet.
    // Doing it the other way round left a real gym with an access-control
    // account marked active, pointing at a vendor, holding no credentials at
    // all: the deployed key was 21 bytes instead of 32, and the throw landed
    // after the account row was already written and before the guard below
    // could deactivate it.
    const emailCiphertext = encryptSecret(input.email)
    const passwordCiphertext = encryptSecret(input.password)

    const { data: accountData, error: accountError } = await this.supabase
      .from('access_control_accounts')
      .upsert(
        {
          gym_id: gymId,
          base_url: input.baseUrl,
          area_id: input.areaId ?? 1,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'gym_id' }
      )
      .select()
      .single()

    if (accountError || !accountData) {
      throw new DatabaseError(
        `Failed to save access control account: ${accountError?.message ?? 'no row returned'}`
      )
    }

    const account = accountData as AccessControlAccount

    const { error: secretError } = await this.supabase
      .from('access_control_secrets')
      .upsert(
        {
          account_id: account.id,
          email_ciphertext: emailCiphertext,
          password_ciphertext: passwordCiphertext,
          // A new password invalidates any cached token.
          api_token_ciphertext: null,
          token_expires_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_id' }
      )

    if (secretError) {
      // Do not leave an account row claiming to be configured when its
      // credentials never landed — every later call would fail obscurely.
      await this.supabase
        .from('access_control_accounts')
        .update({ is_active: false })
        .eq('id', account.id)

      throw new DatabaseError(
        `Failed to save access control credentials: ${secretError.message}`
      )
    }

    return account
  }

  async markAccountVerificationFailed(gymId: string): Promise<void> {
    // Clearing the timestamp rather than keeping a stale one: a date that
    // describes a moment which has since been disproved is worse than no date,
    // because the card renders it beside a green tick.
    const { error } = await this.supabase
      .from('access_control_accounts')
      .update({ last_verified_at: null })
      .eq('gym_id', gymId)

    if (error) {
      throw new DatabaseError(
        `Failed to record credential failure: ${error.message}`
      )
    }
  }

  async markAccountVerified(gymId: string): Promise<void> {
    const { error } = await this.supabase
      .from('access_control_accounts')
      .update({ last_verified_at: new Date().toISOString() })
      .eq('gym_id', gymId)

    if (error) {
      throw new DatabaseError(
        `Failed to record credential verification: ${error.message}`
      )
    }
  }

  // ============================================================
  // Devices
  // ============================================================

  async listDevices(gymId: string): Promise<AccessDevice[]> {
    return this.pageAll<AccessDevice>('access_devices', (query) =>
      query.eq('gym_id', gymId).order('created_at', { ascending: true })
    )
  }

  async listActiveDeviceSerials(gymId: string): Promise<string[]> {
    const devices = await this.pageAll<{ device_serial: string }>(
      'access_devices',
      (query) =>
        query
          .eq('gym_id', gymId)
          .eq('is_active', true)
          .order('created_at', { ascending: true }),
      'device_serial'
    )

    return devices.map((d) => d.device_serial)
  }

  async findDeviceById(
    gymId: string,
    deviceId: string
  ): Promise<AccessDevice | null> {
    // Filtered on both columns rather than relying on RLS alone. The vendor
    // token reaches every terminal on the account, so a device operation that
    // resolved its target by id only would be one policy change away from
    // opening another gym's door.
    const { data, error } = await this.supabase
      .from('access_devices')
      .select('*')
      .eq('gym_id', gymId)
      .eq('id', deviceId)
      .maybeSingle()

    if (error) {
      throw new DatabaseError(`Failed to load device: ${error.message}`)
    }

    return (data as AccessDevice | null) ?? null
  }

  /**
   * Resolve a reader from its serial — the routing key for every inbound scan.
   *
   * ## Why this is not a plain equality check
   *
   * The serial arrives from two places that need not agree on case or
   * whitespace: a person typing what is printed on the reader, and the vendor's
   * own push payload. A mismatch between them is **silent and total** — the
   * event is counted as another company's traffic and dropped, the reader still
   * shows as registered, and nothing retries, because the device already had
   * its 200. So an exact match is tried first and a case-insensitive match
   * second.
   *
   * ## Why the candidate is re-checked in JavaScript
   *
   * `_` is a single-character wildcard in `LIKE`/`ILIKE`, and the registration
   * charset permits it. Left to the database, `NYU_123` would match `NYU-123`
   * and attribute one gym's scan to another gym's reader — a tenant boundary
   * crossed by a punctuation mark. The `ilike` is therefore a *candidate
   * filter* only; the authoritative comparison happens here.
   *
   * @param deviceSerial - Serial as the vendor sent it, or as a person typed it.
   * @returns The reader, or `null` when no serial matches case-insensitively.
   */
  async findDeviceBySerial(deviceSerial: string): Promise<AccessDevice | null> {
    const serial = deviceSerial.trim()

    const { data, error } = await this.supabase
      .from('access_devices')
      .select('*')
      .eq('device_serial', serial)
      .maybeSingle()

    if (error) {
      throw new DatabaseError(`Failed to load device: ${error.message}`)
    }

    if (data) return data as AccessDevice

    const { data: candidates, error: fallbackError } = await this.supabase
      .from('access_devices')
      .select('*')
      .ilike('device_serial', serial)
      .limit(SERIAL_CANDIDATE_LIMIT)

    if (fallbackError) {
      throw new DatabaseError(`Failed to load device: ${fallbackError.message}`)
    }

    const matches = ((candidates ?? []) as AccessDevice[]).filter(
      (device) =>
        device.device_serial.trim().toLowerCase() === serial.toLowerCase()
    )

    if (matches.length > 1) {
      // Two readers whose serials differ only in case. The exact match above
      // already failed, so there is no principled way to choose between them —
      // and choosing wrong files a scan under the wrong gym. Refusing loses
      // one event; guessing corrupts a tenant boundary.
      console.error(
        `Ambiguous device serial "${serial}": ${matches.length} readers match case-insensitively. Event dropped.`
      )
      return null
    }

    const match = matches[0]

    if (match) {
      // Worth saying out loud: it works, but the two records disagree, and the
      // next person to compare the dashboard with the vendor console will lose
      // time to it.
      console.warn(
        `Device serial matched case-insensitively: stored "${match.device_serial}", received "${serial}"`
      )
    }

    return match ?? null
  }

  async registerDevice(
    gymId: string,
    input: {
      deviceSerial: string
      deviceName: string
      areaId?: number | null
      timezoneOffsetMinutes?: number
    }
  ): Promise<AccessDevice> {
    const { data, error } = await this.supabase
      .from('access_devices')
      .insert({
        gym_id: gymId,
        device_serial: input.deviceSerial,
        device_name: input.deviceName,
        area_id: input.areaId ?? 1,
        timezone_offset_minutes: input.timezoneOffsetMinutes ?? 330,
      })
      .select()
      .single()

    if (error) {
      throw this.translate(
        error,
        `Failed to register device ${input.deviceSerial}`
      )
    }

    return data as AccessDevice
  }

  async setDeviceActive(deviceId: string, isActive: boolean): Promise<void> {
    await this.updateDevice(deviceId, { is_active: isActive })
  }

  async renameDevice(deviceId: string, deviceName: string): Promise<void> {
    await this.updateDevice(deviceId, { device_name: deviceName })
  }

  async unlinkDevice(deviceId: string): Promise<void> {
    const { error } = await this.supabase
      .from('access_devices')
      .delete()
      .eq('id', deviceId)

    if (error) {
      throw new DatabaseError(`Failed to unlink device: ${error.message}`)
    }
  }

  async markDeviceSeen(deviceSerial: string, seenAt: Date): Promise<void> {
    // Never moves `last_seen_at` backwards: contact evidence arrives from two
    // sources at different latencies, and an older vendor timestamp must not
    // overwrite a fresher scan.
    const { error } = await this.supabase
      .from('access_devices')
      .update({ last_seen_at: seenAt.toISOString() })
      .eq('device_serial', deviceSerial)
      .or(`last_seen_at.is.null,last_seen_at.lt.${seenAt.toISOString()}`)

    if (error) {
      throw new DatabaseError(
        `Failed to record device contact: ${error.message}`
      )
    }
  }

  async recordDeviceCapacity(
    deviceSerial: string,
    capacity: number
  ): Promise<void> {
    const { error } = await this.supabase
      .from('access_devices')
      .update({
        template_capacity: capacity,
        updated_at: new Date().toISOString(),
      })
      .eq('device_serial', deviceSerial)

    if (error) {
      throw new DatabaseError(
        `Failed to record device capacity: ${error.message}`
      )
    }
  }

  async recordDeviceClockSkew(
    deviceSerial: string,
    skewSeconds: number
  ): Promise<void> {
    const { error } = await this.supabase
      .from('access_devices')
      .update({
        clock_skew_seconds: Math.round(skewSeconds),
        clock_skew_measured_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      })
      .eq('device_serial', deviceSerial)

    if (error) {
      throw new DatabaseError(`Failed to record clock skew: ${error.message}`)
    }
  }

  // ============================================================
  // Subjects
  // ============================================================

  async getMemberAccessContext(
    memberId: string
  ): Promise<MemberAccessContext | null> {
    const { data, error } = await this.supabase
      .from('members')
      .select(
        `id, gym_id, name, status, membership_start_date, next_due_date,
         registration_source, verified_at, biometric_consent_at,
         member_access_subjects (*)`
      )
      .eq('id', memberId)
      .maybeSingle()

    if (error) {
      throw new DatabaseError(
        `Failed to load member access context: ${error.message}`
      )
    }

    if (!data) return null

    return this.toMemberContext(data as unknown as MemberContextRow)
  }

  /** Map a joined member row into the context the domain layer expects. */
  private toMemberContext(row: MemberContextRow): MemberAccessContext {
    const subject = Array.isArray(row.member_access_subjects)
      ? (row.member_access_subjects[0] ?? null)
      : (row.member_access_subjects ?? null)

    return {
      memberId: row.id,
      gymId: row.gym_id,
      memberName: row.name,
      status: row.status,
      // DATE columns arrive as 'YYYY-MM-DD'. Parsed as calendar days, never
      // with a bare `new Date(string)`, which would reintroduce the timezone
      // shift the domain layer exists to avoid.
      membershipStartDate: parseCalendarDate(row.membership_start_date),
      nextDueDate: parseCalendarDate(row.next_due_date),
      registrationSource: row.registration_source,
      verifiedAt: row.verified_at ? new Date(row.verified_at) : null,
      biometricConsentAt: row.biometric_consent_at
        ? new Date(row.biometric_consent_at)
        : null,
      subject,
    }
  }

  async listMemberIdsOnDevice(
    gymId: string,
    deviceSerial: string
  ): Promise<string[]> {
    const rows = await this.pageAll<{ member_id: string }>(
      'member_access_subjects',
      (query) =>
        query
          .eq('gym_id', gymId)
          .contains('synced_device_serials', [deviceSerial])
          .order('created_at', { ascending: true }),
      'member_id'
    )

    return rows.map((r) => r.member_id)
  }

  async listMembersNeedingReconcile(gymId: string): Promise<string[]> {
    const rows = await this.pageAll<{ member_id: string }>(
      'member_access_subjects',
      (query) =>
        query.eq('gym_id', gymId).order('created_at', { ascending: true }),
      'member_id'
    )

    return rows.map((r) => r.member_id)
  }

  async listSubjectsForReconcile(
    gymId: string
  ): Promise<MemberAccessContext[]> {
    const rows = await this.pageAll<MemberContextRow>(
      'members',
      (query) => query.eq('gym_id', gymId).order('id', { ascending: true }),
      // biometric_consent_at is selected even though the reconciler never
      // reads it: both selects feed `toMemberContext`, so omitting it here
      // would hand back a context whose `biometricConsentAt` is null for
      // reasons of the query rather than of the member. A field that means
      // "must ask again" cannot be allowed to lie in that direction.
      `id, gym_id, name, status, membership_start_date, next_due_date,
       registration_source, verified_at, biometric_consent_at,
       member_access_subjects!inner (*)`
    )

    return rows.map((row) => this.toMemberContext(row))
  }

  async listGymsWithAccessControl(): Promise<string[]> {
    const rows = await this.pageAll<{ gym_id: string }>(
      'access_control_accounts',
      (query) =>
        query.eq('is_active', true).order('created_at', { ascending: true }),
      'gym_id'
    )

    return rows.map((r) => r.gym_id)
  }

  /**
   * Subjects that could be evicted to reclaim reader capacity.
   *
   * Filtered to members who cannot currently enter — an active member is never
   * a candidate, and the query enforces that rather than trusting the caller.
   * Ordering is left to the pure selector in `domain/EvictionPolicy.ts`.
   */
  async listEvictionCandidates(gymId: string): Promise<EvictionCandidate[]> {
    const rows = await this.pageAll<{
      member_id: string
      subject_id: number
      members: { status: MemberStatus; next_due_date: string } | null
    }>(
      'member_access_subjects',
      (query) =>
        query
          .eq('gym_id', gymId)
          .eq('on_device', true)
          .order('created_at', { ascending: true }),
      'member_id, subject_id, members!inner (status, next_due_date)'
    )

    return rows
      .filter((row) => row.members && row.members.status !== 'active')
      .map((row) => ({
        memberId: row.member_id,
        subjectId: row.subject_id,
        status: row.members!.status,
        nextDueDate: parseCalendarDate(row.members!.next_due_date),
      }))
  }

  async markSubjectOffDevice(memberId: string): Promise<void> {
    const now = new Date().toISOString()

    const { error } = await this.supabase
      .from('member_access_subjects')
      // Emptying the array is what takes the member off every reader;
      // `on_device` follows from it automatically.
      .update({
        synced_device_serials: [],
        device_removed_at: now,
        updated_at: now,
      })
      .eq('member_id', memberId)

    if (error) {
      throw new DatabaseError(
        `Failed to mark subject off device: ${error.message}`
      )
    }
  }

  async replaceSubjectAfterErasure(
    memberId: string,
    newSubjectId: number
  ): Promise<void> {
    const now = new Date().toISOString()

    const { data, error } = await this.supabase
      .from('member_access_subjects')
      .update({
        subject_id: newSubjectId,
        provisioned_at: null,
        synced_device_serials: [],
        device_removed_at: now,
        last_synced_at: null,
        last_synced_valid_from: null,
        last_synced_valid_to: null,
        last_synced_blocked: null,
        finger_enrolled: false,
        finger_id: null,
        enrolled_at: null,
        updated_at: now,
      })
      .eq('member_id', memberId)
      // Without this a no-match update reports success (rule 2.7).
      .select('id')

    if (error) {
      throw new DatabaseError(
        `Failed to replace subject after erasure: ${error.message}`
      )
    }

    if (!data || data.length === 0) {
      throw new DatabaseError(
        'Failed to replace subject after erasure: no row updated'
      )
    }
  }

  async recountDeviceTemplates(deviceId: string): Promise<number> {
    const { data, error } = await this.supabase.rpc(
      'recount_device_templates',
      { p_device_id: deviceId }
    )

    if (error) {
      throw new DatabaseError(
        `Failed to recount device templates: ${error.message}`
      )
    }

    return Number(data ?? 0)
  }

  async reclaimStaleJobs(olderThanSeconds: number): Promise<number> {
    const { data, error } = await this.supabase.rpc(
      'reclaim_stale_access_sync_jobs',
      { p_older_than_seconds: olderThanSeconds }
    )

    if (error) {
      throw new DatabaseError(`Failed to reclaim stale jobs: ${error.message}`)
    }

    return Number(data ?? 0)
  }

  async allocateSubjectId(): Promise<number> {
    const { data, error } = await this.supabase.rpc(
      'allocate_access_subject_id'
    )

    if (error) {
      // The function names exhaustion deliberately: the raw Postgres message
      // would not tell an operator what to do about it.
      if (error.message.includes('ACCESS_SUBJECT_ID_EXHAUSTED')) {
        throw new DatabaseError(
          'Device identifier range is fully allocated. Recycle ids from purged members, or move to per-gym vendor accounts.'
        )
      }

      throw new DatabaseError(
        `Failed to allocate a device identifier: ${error.message}`
      )
    }

    return Number(data)
  }

  async createSubject(
    gymId: string,
    memberId: string,
    subjectId: number
  ): Promise<MemberAccessSubject> {
    const { data, error } = await this.supabase
      .from('member_access_subjects')
      .insert({ gym_id: gymId, member_id: memberId, subject_id: subjectId })
      .select()
      .single()

    if (error) {
      throw this.translate(
        error,
        `Failed to create access subject for member ${memberId}`
      )
    }

    return data as MemberAccessSubject
  }

  async updateSyncState(
    memberId: string,
    update: SyncStateUpdate
  ): Promise<void> {
    const now = new Date().toISOString()

    const { error } = await this.supabase
      .from('member_access_subjects')
      .update({
        provisioned_at: update.provisioned ? now : null,
        // `on_device` is generated from this array — never written directly,
        // so the two cannot drift apart the way a hand-maintained pair did.
        synced_device_serials: update.syncedDeviceSerials,
        device_removed_at: update.syncedDeviceSerials.length > 0 ? null : now,
        last_synced_at: now,
        last_synced_valid_from: update.validFrom
          ? toIsoDate(update.validFrom)
          : null,
        last_synced_valid_to: update.validTo ? toIsoDate(update.validTo) : null,
        last_synced_blocked: update.blocked,
        updated_at: now,
      })
      .eq('member_id', memberId)

    if (error) {
      throw new DatabaseError(`Failed to record sync state: ${error.message}`)
    }
  }

  async setBiometricEnrolled(
    memberId: string,
    enrolled: boolean,
    fingerId?: number | null
  ): Promise<void> {
    const { error } = await this.supabase
      .from('member_access_subjects')
      .update({
        finger_enrolled: enrolled,
        finger_id: fingerId ?? null,
        enrolled_at: enrolled ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('member_id', memberId)

    if (error) {
      throw new DatabaseError(
        `Failed to update enrolment state: ${error.message}`
      )
    }
  }

  /**
   * Flip `finger_enrolled` on the strength of a fingerprint scan.
   *
   * `.eq('finger_enrolled', false)` is what makes this cheap AND safe: cheap
   * because a member who scans twice a day costs one write ever, safe because
   * it can only ever move the flag one way.
   *
   * The row count is the evidence, not the absence of an error — an RLS-refused
   * or no-match UPDATE reports success with nothing written (F11), which is the
   * shape rule 2.7 exists to stop. `.select('id')` is what makes a count
   * available at all.
   */
  async confirmBiometricEnrolmentFromScan(
    memberId: string,
    observedAt: Date
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('member_access_subjects')
      .update({
        finger_enrolled: true,
        // The scan is the first moment we KNOW a template exists, which is
        // what this column has always meant. `finger_id` is deliberately
        // untouched: a scan does not say which finger it was.
        enrolled_at: observedAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('member_id', memberId)
      .eq('finger_enrolled', false)
      .select('id')

    if (error) {
      throw new DatabaseError(
        `Failed to confirm enrolment from scan: ${error.message}`
      )
    }

    return (data?.length ?? 0) > 0
  }

  /**
   * Record consent to fingerprint collection, once.
   *
   * `.is('biometric_consent_at', null)` is the whole safeguard: re-enrolling a
   * member who already consented must not restamp the date, because the audit
   * question is when they first agreed, not when we last asked them to tick a
   * box. Matching no rows is the expected outcome then, not an error.
   */
  async recordBiometricConsent(memberId: string, at: Date): Promise<void> {
    const { error } = await this.supabase
      .from('members')
      .update({
        biometric_consent_at: at.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId)
      .is('biometric_consent_at', null)

    if (error) {
      throw new DatabaseError(
        `Failed to record biometric consent: ${error.message}`
      )
    }
  }

  async clearBiometricConsent(memberId: string): Promise<void> {
    const { error } = await this.supabase
      .from('members')
      .update({
        biometric_consent_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId)

    if (error) {
      throw new DatabaseError(
        `Failed to withdraw biometric consent: ${error.message}`
      )
    }
  }

  // ============================================================
  // Outbox
  // ============================================================

  async enqueue(
    gymId: string,
    memberId: string | null,
    intent: string,
    payload: Record<string, unknown> = {},
    notBefore?: Date
  ): Promise<void> {
    const { error } = await this.supabase.from('access_sync_jobs').insert({
      gym_id: gymId,
      member_id: memberId,
      intent,
      payload,
      // Omitted for an ordinary job so the column default (now) applies.
      ...(notBefore ? { next_attempt_at: notBefore.toISOString() } : {}),
    })

    if (error) {
      throw new DatabaseError(`Failed to enqueue access sync: ${error.message}`)
    }
  }

  async enqueueMany(
    gymId: string,
    jobs: Array<{
      memberId: string
      intent: string
      payload?: Record<string, unknown>
      notBefore?: Date
    }>
  ): Promise<number> {
    if (jobs.length === 0) return 0

    let inserted = 0

    // Chunked: one insert per job is a round trip each, and a gym's reader can
    // hold hundreds of members (restart repair, visit 1 D1).
    for (let from = 0; from < jobs.length; from += ENQUEUE_CHUNK_SIZE) {
      const chunk = jobs.slice(from, from + ENQUEUE_CHUNK_SIZE)

      const { data, error } = await this.supabase
        .from('access_sync_jobs')
        .insert(
          chunk.map((job) => ({
            gym_id: gymId,
            member_id: job.memberId,
            intent: job.intent,
            payload: job.payload ?? {},
            ...(job.notBefore
              ? { next_attempt_at: job.notBefore.toISOString() }
              : {}),
          }))
        )
        .select('id')

      if (error) {
        throw new DatabaseError(
          `Failed to enqueue access sync: ${error.message}`
        )
      }

      inserted += data?.length ?? 0
    }

    return inserted
  }

  async hasRecentJob(
    memberId: string,
    reason: string,
    sinceSeconds: number
  ): Promise<boolean> {
    const since = new Date(Date.now() - sinceSeconds * 1000).toISOString()

    const { data, error } = await this.supabase
      .from('access_sync_jobs')
      .select('id')
      .eq('member_id', memberId)
      .eq('payload->>reason', reason)
      .gte('created_at', since)
      .limit(1)

    if (error) {
      throw new DatabaseError(`Failed to read recent jobs: ${error.message}`)
    }

    return (data?.length ?? 0) > 0
  }

  async hasRecentEventsPull(
    gymId: string,
    deviceSerial: string,
    sinceSeconds: number
  ): Promise<boolean> {
    const since = new Date(Date.now() - sinceSeconds * 1000).toISOString()

    const { data, error } = await this.supabase
      .from('access_sync_jobs')
      .select('id')
      .eq('gym_id', gymId)
      .eq('intent', AccessIntent.EventsPull)
      .eq('payload->>deviceSerial', deviceSerial)
      .gte('created_at', since)
      .limit(1)

    if (error) {
      throw new DatabaseError(
        `Failed to read recent events pulls: ${error.message}`
      )
    }

    return (data?.length ?? 0) > 0
  }

  /**
   * Claim due jobs via the SQL function.
   *
   * The locking and the one-per-member rule live in the database because
   * neither can be made race-free from here — see
   * `claim_access_sync_jobs` in migration 20260810000002.
   */
  async claimDueJobs(limit: number): Promise<AccessSyncJob[]> {
    const { data, error } = await this.supabase.rpc('claim_access_sync_jobs', {
      p_limit: limit,
    })

    if (error) {
      throw new DatabaseError(`Failed to claim sync jobs: ${error.message}`)
    }

    return (data as AccessSyncJob[]) ?? []
  }

  async completeJob(
    jobId: string,
    status: AccessSyncStatus,
    expectedAttempts?: number
  ): Promise<boolean> {
    const update = this.supabase
      .from('access_sync_jobs')
      .update({
        status,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    return this.settleJob(update, expectedAttempts, 'complete sync job')
  }

  async failJob(
    jobId: string,
    errorMessage: string,
    retryable: boolean,
    expectedAttempts?: number
  ): Promise<boolean> {
    let attempts = expectedAttempts

    // Unguarded callers still read the row for the backoff. A guarded caller
    // already knows the attempt it claimed, which is both the right input (the
    // row may now belong to another run) and one round trip fewer.
    if (attempts === undefined) {
      const { data, error: readError } = await this.supabase
        .from('access_sync_jobs')
        .select('attempts')
        .eq('id', jobId)
        .maybeSingle()

      if (readError) {
        throw new DatabaseError(
          `Failed to load sync job for retry: ${readError.message}`
        )
      }

      attempts = (data as { attempts: number } | null)?.attempts ?? 1
    }

    const backoff = backoffSecondsFor(attempts)

    // A non-retryable failure is dead-lettered immediately: retrying it would
    // fail identically and bury the real problem.
    const status =
      !retryable || backoff === null
        ? AccessSyncStatus.Dead
        : AccessSyncStatus.Failed

    const nextAttempt =
      status === AccessSyncStatus.Failed && backoff !== null
        ? new Date(Date.now() + backoff * 1000).toISOString()
        : new Date().toISOString()

    const update = this.supabase
      .from('access_sync_jobs')
      .update({
        status,
        last_error: errorMessage,
        next_attempt_at: nextAttempt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    return this.settleJob(update, expectedAttempts, 'record sync failure')
  }

  async countDeadJobs(memberId?: string): Promise<number> {
    let query = this.supabase
      .from('access_sync_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', AccessSyncStatus.Dead)

    if (memberId) {
      query = query.eq('member_id', memberId)
    }

    const { count, error } = await query

    if (error) {
      throw new DatabaseError(`Failed to count dead jobs: ${error.message}`)
    }

    return count ?? 0
  }

  async countPendingJobs(memberId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('access_sync_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('member_id', memberId)
      .in('status', [
        AccessSyncStatus.Pending,
        AccessSyncStatus.InFlight,
        AccessSyncStatus.Failed,
      ])

    if (error) {
      throw new DatabaseError(`Failed to count pending jobs: ${error.message}`)
    }

    return count ?? 0
  }

  // ============================================================
  // Events
  // ============================================================

  async recordEvents(
    gymId: string,
    events: IncomingAccessEvent[]
  ): Promise<{ inserted: number; duplicates: number }> {
    if (events.length === 0) return { inserted: 0, duplicates: 0 }

    const rows = events.map((event) => ({
      gym_id: gymId,
      member_id: event.memberId,
      device_serial: event.deviceSerial,
      subject_id: event.subjectId,
      occurred_at: event.occurredAt.toISOString(),
      verify_type: event.verifyType,
      checking_status: event.checkingStatus,
      event_code: event.eventCode,
      raw: event.raw,
    }))

    const { data, error } = await this.supabase
      .from('access_events')
      .upsert(rows, {
        onConflict: 'gym_id,device_serial,subject_id,occurred_at',
        ignoreDuplicates: true,
      })
      .select('id')

    if (error) {
      throw new DatabaseError(
        `Failed to record access events: ${error.message}`
      )
    }

    const inserted = (data as { id: string }[] | null)?.length ?? 0

    return { inserted, duplicates: events.length - inserted }
  }

  async listEvents(
    gymId: string,
    query: {
      page: number
      limit: number
      memberId?: string
      kind?: DeviceEventKind
    }
  ): Promise<{ events: AccessEventWithMember[]; total: number }> {
    const from = (query.page - 1) * query.limit
    const to = from + query.limit - 1

    let request = this.supabase
      .from('access_events')
      // The member's name comes from the join rather than being denormalised
      // onto the event: a log showing UUIDs answers nobody's question, and a
      // copied name would be wrong the moment the member is renamed.
      .select('*, members(name)', { count: 'exact' })
      .eq('gym_id', gymId)
      // Newest first (rule 2.10): the log is read from the top, and a
      // most-recent lookup over an unordered result is a coin toss.
      .order('occurred_at', { ascending: false })

    if (query.memberId) {
      request = request.eq('member_id', query.memberId)
    }

    if (query.kind) {
      // Filtered in the database, not after the fetch. Filtering a page of 50
      // rows in application code would return however many survived, which
      // makes pagination lie.
      request = request.in('event_code', codesForKind(query.kind).map(String))
    }

    const { data, error, count } = await request.range(from, to)

    if (error) {
      throw new DatabaseError(`Failed to load access events: ${error.message}`)
    }

    const rows =
      (data as
        (AccessEvent & { members?: { name: string } | null })[] | null) ?? []

    return {
      events: rows.map((row) => ({
        ...row,
        memberName: row.members?.name ?? null,
      })),
      total: count ?? 0,
    }
  }

  /**
   * Delete a bounded batch of scans received before the cutoff.
   *
   * ## Why `created_at` and not `occurred_at`
   *
   * `occurred_at` comes from the **device's own clock** — it is `AttTime`
   * parsed against that reader's stored timezone offset. This whole feature
   * already treats device clocks as untrustworthy: drift is *inferred* rather
   * than read, and `DEVICE_CLOCK_SKEW_ALERT_SECONDS` exists precisely because
   * they wander. A reader whose RTC has reset, lost its battery, or been given
   * the wrong offset stamps today's entries with a date a year or more in the
   * past, and purging on that figure would delete this morning's scans tonight
   * — irreversibly, reported as a perfectly normal `deleted: N`.
   *
   * `created_at` is set by the database when *we* stored the row. It cannot be
   * wrong, it is monotonic, and it is what a retention promise actually
   * measures: how long we keep something after receiving it. A reader that was
   * offline for months and then uploads its buffer keeps those scans for 12
   * months from upload — longer than strictly needed, which is the safe
   * direction. Deletion is not reversible, so this must fail toward keeping.
   *
   * ## Why the delete is chunked
   *
   * PostgREST has no `DELETE ... LIMIT`, so the ids are read first and deleted
   * by primary key — and `.in()` puts every id in the **query string**. 500
   * UUIDs is a 19.5 KB request line, comfortably past the ~8 KB an nginx-family
   * gateway accepts, so the whole run would fail with a 414 the first time a
   * gym had a real backlog. Chunking keeps each request near 4 KB.
   *
   * Reading oldest-first matters too — it means repeated calls walk forward
   * through the backlog instead of re-reading the same arbitrary slice.
   *
   * Platform-wide, so this needs a service-role client; under a session client
   * RLS would silently scope it to one gym and the purge would quietly stop
   * being a platform guarantee.
   */
  async deleteEventsOlderThan(cutoff: Date, limit: number): Promise<number> {
    const { data, error } = await this.supabase
      .from('access_events')
      .select('id')
      .lt('created_at', cutoff.toISOString())
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      throw new DatabaseError(
        `Failed to list expired access events: ${error.message}`
      )
    }

    const ids = ((data as { id: string }[] | null) ?? []).map((row) => row.id)
    if (ids.length === 0) return 0

    for (let i = 0; i < ids.length; i += ACCESS_EVENT_DELETE_CHUNK_SIZE) {
      const chunk = ids.slice(i, i + ACCESS_EVENT_DELETE_CHUNK_SIZE)

      const { error: deleteError } = await this.supabase
        .from('access_events')
        .delete()
        .in('id', chunk)

      if (deleteError) {
        throw new DatabaseError(
          `Failed to delete expired access events: ${deleteError.message}`
        )
      }
    }

    return ids.length
  }

  async findExistingEvents(
    gymId: string,
    deviceSerial: string,
    from: Date,
    to: Date
  ): Promise<
    Array<{ subjectId: number; occurredAt: Date; eventCode: string | null }>
  > {
    const rows = await this.pageAll<{
      subject_id: number
      occurred_at: string
      event_code: string | null
    }>(
      'access_events',
      (query) =>
        query
          .eq('gym_id', gymId)
          .eq('device_serial', deviceSerial)
          .gte('occurred_at', from.toISOString())
          .lte('occurred_at', to.toISOString())
          // Stable paging needs an order; the instant is the natural one.
          .order('occurred_at', { ascending: true }),
      'subject_id, occurred_at, event_code'
    )

    return rows.map((row) => ({
      subjectId: row.subject_id,
      occurredAt: new Date(row.occurred_at),
      eventCode: row.event_code,
    }))
  }

  async findGymIdByDeviceSerial(deviceSerial: string): Promise<string | null> {
    const device = await this.findDeviceBySerial(deviceSerial)
    return device?.gym_id ?? null
  }

  async findMemberIdBySubjectId(
    gymId: string,
    subjectId: number
  ): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('member_access_subjects')
      .select('member_id')
      .eq('gym_id', gymId)
      .eq('subject_id', subjectId)
      .maybeSingle()

    if (error) {
      throw new DatabaseError(
        `Failed to resolve subject to member: ${error.message}`
      )
    }

    return (data as { member_id: string } | null)?.member_id ?? null
  }

  async findMemberIdsBySubjectIds(
    gymId: string,
    subjectIds: number[]
  ): Promise<Map<number, string>> {
    const resolved = new Map<number, string>()
    if (subjectIds.length === 0) return resolved

    // `.in()` puts every id in the query string, so the list is chunked to keep
    // each request line well under what a gateway accepts (trap 15).
    for (let i = 0; i < subjectIds.length; i += SUBJECT_LOOKUP_CHUNK_SIZE) {
      const chunk = subjectIds.slice(i, i + SUBJECT_LOOKUP_CHUNK_SIZE)

      const { data, error } = await this.supabase
        .from('member_access_subjects')
        .select('member_id, subject_id')
        .eq('gym_id', gymId)
        .in('subject_id', chunk)

      if (error) {
        throw new DatabaseError(
          `Failed to resolve subjects to members: ${error.message}`
        )
      }

      for (const row of (data as
        { member_id: string; subject_id: number }[] | null) ?? []) {
        resolved.set(row.subject_id, row.member_id)
      }
    }

    return resolved
  }

  // ============================================================
  // Internals
  // ============================================================

  /**
   * Read every matching row, a page at a time.
   *
   * A bare `.select()` stops at the project's `db-max-rows`. For a reconcile
   * list that silently means "these members never sync again", so unbounded
   * reads go through here rather than trusting a single call.
   *
   * @param table - Table to read.
   * @param applyFilters - Filters and ordering. Ordering is required for
   *   stable paging — without it the server may return overlapping pages.
   * @param columns - Columns to select.
   */
  private async pageAll<T>(
    table: string,
    applyFilters: (
      query: ReturnType<ReturnType<SupabaseClient['from']>['select']>
    ) => ReturnType<ReturnType<SupabaseClient['from']>['select']>,
    columns = '*'
  ): Promise<T[]> {
    const results: T[] = []

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const query = applyFilters(this.supabase.from(table).select(columns))
      const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1)

      if (error) {
        throw new DatabaseError(`Failed to read ${table}: ${error.message}`)
      }

      const page = (data as T[] | null) ?? []
      results.push(...page)

      if (page.length < PAGE_SIZE) break
    }

    return results
  }

  /**
   * Finish a job-result update, guarded by the attempt that claimed the job.
   *
   * With `expectedAttempts` the write only lands on a job still `in_flight` at
   * that attempt, and `.select('id')` reports whether a row actually changed —
   * an update that matches nothing is a success to PostgREST, which is how a
   * reclaimed job's result used to vanish without a trace (remote day, F-10).
   * Without it the update is unconditional, as before: nothing is guarded and
   * there is nothing to report.
   */
  private async settleJob(
    update: ReturnType<ReturnType<SupabaseClient['from']>['update']>,
    expectedAttempts: number | undefined,
    action: string
  ): Promise<boolean> {
    if (expectedAttempts === undefined) {
      const { error } = await update

      if (error) {
        throw new DatabaseError(`Failed to ${action}: ${error.message}`)
      }

      return true
    }

    const { data, error } = await update
      .eq('status', AccessSyncStatus.InFlight)
      .eq('attempts', expectedAttempts)
      .select('id')

    if (error) {
      throw new DatabaseError(`Failed to ${action}: ${error.message}`)
    }

    return (data?.length ?? 0) > 0
  }

  private async updateDevice(
    deviceId: string,
    patch: Record<string, unknown>
  ): Promise<void> {
    const { data, error } = await this.supabase
      .from('access_devices')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', deviceId)
      .select('id')
      .maybeSingle()

    if (error) {
      throw new DatabaseError(`Failed to update device: ${error.message}`)
    }

    if (!data) {
      throw new NotFoundError(`Device ${deviceId}`)
    }
  }

  /**
   * Turn a driver error into a domain error.
   *
   * Postgres unique violations are a conflict, not a generic database fault —
   * routes translate the two to different status codes.
   */
  private translate(
    error: { code?: string; message: string },
    context: string
  ): Error {
    if (error.code === '23505') {
      return new ConflictError(`${context}: already exists`)
    }

    return new DatabaseError(`${context}: ${error.message}`)
  }
}

/** Parse a `YYYY-MM-DD` column into a calendar day at UTC midnight. */
function parseCalendarDate(value: string): Date {
  return toCalendarDay(new Date(`${value.slice(0, 10)}T00:00:00.000Z`))
}

/** Convert a device `YYYYMMDD` string back to an ISO date for storage. */
function toIsoDate(deviceDate: string): string {
  if (deviceDate.length !== 8) return deviceDate
  return `${deviceDate.slice(0, 4)}-${deviceDate.slice(4, 6)}-${deviceDate.slice(6, 8)}`
}

/**
 * Backoff for the given attempt number, or `null` once the budget is spent.
 *
 * `null` means the job has exhausted its retries and should be dead-lettered
 * rather than rescheduled forever.
 */
function backoffSecondsFor(attempts: number): number | null {
  const index = Math.max(0, attempts - 1)
  return SYNC_RETRY_BACKOFF_SECONDS[index] ?? null
}
