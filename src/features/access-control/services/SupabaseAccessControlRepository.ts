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
  AccessSyncStatus,
  SYNC_RETRY_BACKOFF_SECONDS,
} from '@/features/access-control/config/AccessControlConfig'
import { toCalendarDay } from '@/features/access-control/utils/getGymToday'
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
  member_access_subjects: MemberAccessSubject[] | MemberAccessSubject | null
}

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
          email_ciphertext: encryptSecret(input.email),
          password_ciphertext: encryptSecret(input.password),
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

  async findDeviceBySerial(deviceSerial: string): Promise<AccessDevice | null> {
    const { data, error } = await this.supabase
      .from('access_devices')
      .select('*')
      .eq('device_serial', deviceSerial)
      .maybeSingle()

    if (error) {
      throw new DatabaseError(`Failed to load device: ${error.message}`)
    }

    return (data as AccessDevice | null) ?? null
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
         registration_source, verified_at,
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
      subject,
    }
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
      `id, gym_id, name, status, membership_start_date, next_due_date,
       registration_source, verified_at, member_access_subjects!inner (*)`
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

  // ============================================================
  // Outbox
  // ============================================================

  async enqueue(
    gymId: string,
    memberId: string | null,
    intent: string,
    payload: Record<string, unknown> = {}
  ): Promise<void> {
    const { error } = await this.supabase.from('access_sync_jobs').insert({
      gym_id: gymId,
      member_id: memberId,
      intent,
      payload,
    })

    if (error) {
      throw new DatabaseError(`Failed to enqueue access sync: ${error.message}`)
    }
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

  async completeJob(jobId: string, status: AccessSyncStatus): Promise<void> {
    const { error } = await this.supabase
      .from('access_sync_jobs')
      .update({
        status,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    if (error) {
      throw new DatabaseError(`Failed to complete sync job: ${error.message}`)
    }
  }

  async failJob(
    jobId: string,
    errorMessage: string,
    retryable: boolean
  ): Promise<void> {
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

    const attempts = (data as { attempts: number } | null)?.attempts ?? 1
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

    const { error } = await this.supabase
      .from('access_sync_jobs')
      .update({
        status,
        last_error: errorMessage,
        next_attempt_at: nextAttempt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    if (error) {
      throw new DatabaseError(`Failed to record sync failure: ${error.message}`)
    }
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
    query: { page: number; limit: number; memberId?: string }
  ): Promise<{ events: AccessEvent[]; total: number }> {
    const from = (query.page - 1) * query.limit
    const to = from + query.limit - 1

    let request = this.supabase
      .from('access_events')
      .select('*', { count: 'exact' })
      .eq('gym_id', gymId)
      // Newest first (rule 2.10): the log is read from the top, and a
      // most-recent lookup over an unordered result is a coin toss.
      .order('occurred_at', { ascending: false })

    if (query.memberId) {
      request = request.eq('member_id', query.memberId)
    }

    const { data, error, count } = await request.range(from, to)

    if (error) {
      throw new DatabaseError(`Failed to load access events: ${error.message}`)
    }

    return {
      events: (data as AccessEvent[] | null) ?? [],
      total: count ?? 0,
    }
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
