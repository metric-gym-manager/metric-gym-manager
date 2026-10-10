/**
 * In-memory doubles for the access-control use-case suites.
 *
 * The point of these is that every invariant worth proving — a stranded job is
 * reclaimed, a suspended gym is skipped, a blocked member never receives a
 * validity period — is provable without a database or a terminal. The real
 * repository is covered separately against a mocked Supabase client.
 */

import type { AccessCredentials } from '@/lib/access-control'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { RegistrationSource } from '@/features/members/config/RegistrationConfig'
import { AccessSyncStatus } from '@/features/access-control/config/AccessControlConfig'
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
  AccessEventWithMember,
} from '@/features/access-control/services/IAccessControlRepository'

/** A calendar day as a UTC instant, matching how the domain tests build dates. */
export const day = (iso: string): Date => new Date(`${iso}T00:00:00Z`)

export const testCredentials: AccessCredentials = {
  baseUrl: 'https://vft.example.com',
  email: 'gym@example.com',
  password: 'secret',
  areaId: 1,
}

export function makeDevice(
  overrides: Partial<AccessDevice> = {}
): AccessDevice {
  return {
    id: 'device-1',
    gym_id: 'gym-1',
    device_serial: 'SER-001',
    device_name: 'Front Door',
    area_id: 1,
    timezone_offset_minutes: 330,
    is_active: true,
    last_seen_at: null,
    last_synced_at: null,
    template_count: 0,
    template_capacity: null,
    clock_skew_seconds: null,
    clock_skew_measured_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

export function makeSubject(
  overrides: Partial<MemberAccessSubject> = {}
): MemberAccessSubject {
  const base = {
    id: 'subject-row-1',
    gym_id: 'gym-1',
    member_id: 'member-1',
    subject_id: 100001,
    finger_enrolled: true,
    finger_id: 6,
    enrolled_at: '2026-01-01T00:00:00Z',
    provisioned_at: '2026-01-01T00:00:00Z',
    synced_device_serials: ['SER-001'],
    last_synced_at: '2026-01-01T00:00:00Z',
    last_synced_valid_from: null,
    last_synced_valid_to: null,
    last_synced_blocked: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }

  // Derived here exactly as the database derives it, so a fixture can never
  // express the impossible state (`on_device` true with no serials) that the
  // generated column exists to rule out.
  return { ...base, on_device: base.synced_device_serials.length > 0 }
}

export function makeContext(
  overrides: Partial<MemberAccessContext> = {}
): MemberAccessContext {
  return {
    memberId: 'member-1',
    gymId: 'gym-1',
    memberName: 'Test Member',
    status: MemberStatus.Active,
    membershipStartDate: day('2025-12-15'),
    // Deliberately in the future. The default context describes an ACTIVE
    // member, and since 2026-09-23 the enrolment path resolves the access
    // decision before dispatching — a fixture whose due date has drifted into
    // the past would make that member lapsed and every enrolment fixture
    // refuse for the wrong reason. Tests that need a lapsed member set this
    // explicitly.
    nextDueDate: day('2027-01-15'),
    registrationSource: RegistrationSource.Manual,
    verifiedAt: null,
    // Consented by default so the existing suites keep exercising the paths
    // they were written for. The consent gate has its own fixtures that set
    // this to null deliberately.
    biometricConsentAt: new Date('2026-01-01T00:00:00Z'),
    subject: makeSubject(),
    ...overrides,
  }
}

export function makeJob(overrides: Partial<AccessSyncJob> = {}): AccessSyncJob {
  return {
    id: 'job-1',
    gym_id: 'gym-1',
    member_id: 'member-1',
    device_id: null,
    intent: 'reconcile_member' as AccessSyncJob['intent'],
    payload: {},
    status: AccessSyncStatus.InFlight,
    attempts: 1,
    next_attempt_at: '2026-01-10T00:00:00Z',
    last_error: null,
    provider_command_id: null,
    created_at: '2026-01-10T00:00:00Z',
    updated_at: '2026-01-10T00:00:00Z',
    ...overrides,
  }
}

/** What a test enqueued, so a suite can assert on it directly. */
export interface EnqueuedJob {
  gymId: string
  memberId: string | null
  intent: string
  payload?: Record<string, unknown>
  /** Present only when the job was queued to wait. */
  notBefore?: Date
}

/** How a job was settled, in the order it happened. */
export interface SettledJob {
  jobId: string
  outcome: 'completed' | 'failed'
  status?: AccessSyncStatus
  error?: string
  retryable?: boolean
}

export interface FakeRepositoryOptions {
  credentials?: AccessCredentials | null
  devices?: AccessDevice[]
  deviceSerials?: string[]
  contexts?: MemberAccessContext[]
  gymsWithAccessControl?: string[]
  evictionCandidates?: EvictionCandidate[]
  claimable?: AccessSyncJob[]
  staleJobs?: number
  pendingJobs?: number
  deadJobs?: number
  events?: AccessEvent[]
}

/**
 * A recording, in-memory `IAccessControlRepository`.
 *
 * Every method is a real (if trivial) implementation rather than a jest mock,
 * so a use case that starts calling something new fails to compile instead of
 * silently receiving `undefined`.
 */
export class FakeAccessControlRepository implements IAccessControlRepository {
  readonly enqueued: EnqueuedJob[] = []
  readonly settled: SettledJob[] = []
  readonly offDevice: string[] = []
  readonly recounted: string[] = []
  readonly syncStates = new Map<string, SyncStateUpdate>()
  readonly storedEvents: IncomingAccessEvent[] = []
  readonly clockSkews: Array<{ deviceSerial: string; skewSeconds: number }> = []
  readonly seenDevices: Array<{ deviceSerial: string; seenAt: Date }> = []
  readonly enrolments: Array<{
    memberId: string
    enrolled: boolean
    fingerId: number | null
  }> = []
  readonly learnedCapacities: Array<{
    deviceSerial: string
    capacity: number
  }> = []
  /** Members whose enrolment a scan confirmed, in order, once each. */
  readonly scanConfirmedEnrolments: string[] = []
  readonly consentWrites: Array<{ memberId: string; at: Date }> = []
  readonly consentClears: string[] = []
  /** Cutoff/limit pairs the retention purge asked for, in call order. */
  readonly purgeCalls: Array<{ cutoff: Date; limit: number }> = []

  /** Serials already stored, so a repeat delivery counts as a duplicate. */
  private readonly seenEventKeys = new Set<string>()
  private nextSubjectId = 100001
  private claimed = false

  constructor(private readonly options: FakeRepositoryOptions = {}) {}

  // ---- Account -------------------------------------------------------------

  async findAccountByGymId(
    gymId: string
  ): Promise<AccessControlAccount | null> {
    if (!this.options.credentials) return null

    return {
      id: 'account-1',
      gym_id: gymId,
      base_url: this.options.credentials.baseUrl,
      area_id: this.options.credentials.areaId ?? null,
      is_active: true,
      last_verified_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
  }

  async getCredentials(_gymId: string): Promise<AccessCredentials | null> {
    return this.options.credentials ?? null
  }

  async saveCredentials(): Promise<AccessControlAccount> {
    throw new Error('not used in these tests')
  }

  async markAccountVerified(): Promise<void> {}

  /** Gyms whose stored confirmation was cleared, in order. */
  readonly verificationFailures: string[] = []

  async markAccountVerificationFailed(gymId: string): Promise<void> {
    this.verificationFailures.push(gymId)
  }

  // ---- Devices -------------------------------------------------------------

  async listDevices(_gymId: string): Promise<AccessDevice[]> {
    return this.options.devices ?? []
  }

  async listActiveDeviceSerials(_gymId: string): Promise<string[]> {
    if (this.options.deviceSerials) return this.options.deviceSerials
    return (this.options.devices ?? [])
      .filter((d) => d.is_active)
      .map((d) => d.device_serial)
  }

  async findDeviceById(
    gymId: string,
    deviceId: string
  ): Promise<AccessDevice | null> {
    return (
      (this.options.devices ?? []).find(
        (d) => d.id === deviceId && d.gym_id === gymId
      ) ?? null
    )
  }

  async findDeviceBySerial(deviceSerial: string): Promise<AccessDevice | null> {
    // Case- and whitespace-insensitive, like the real repository. A double that
    // only matched exactly could not fail the way production does, and the
    // point of these tests is what happens when the two spellings differ.
    const wanted = deviceSerial.trim().toLowerCase()

    return (
      (this.options.devices ?? []).find(
        (d) => d.device_serial.trim().toLowerCase() === wanted
      ) ?? null
    )
  }

  async registerDevice(): Promise<AccessDevice> {
    throw new Error('not used in these tests')
  }

  async setDeviceActive(): Promise<void> {}

  async renameDevice(): Promise<void> {}

  async unlinkDevice(): Promise<void> {}

  async recordDeviceClockSkew(
    deviceSerial: string,
    skewSeconds: number
  ): Promise<void> {
    this.clockSkews.push({ deviceSerial, skewSeconds })
  }

  async markDeviceSeen(deviceSerial: string, seenAt: Date): Promise<void> {
    this.seenDevices.push({ deviceSerial, seenAt })
  }

  async recordDeviceCapacity(
    deviceSerial: string,
    capacity: number
  ): Promise<void> {
    this.learnedCapacities.push({ deviceSerial, capacity })
  }

  // ---- Subjects ------------------------------------------------------------

  async getMemberAccessContext(
    memberId: string
  ): Promise<MemberAccessContext | null> {
    return (
      (this.options.contexts ?? []).find((c) => c.memberId === memberId) ?? null
    )
  }

  async listMembersNeedingReconcile(gymId: string): Promise<string[]> {
    return (this.options.contexts ?? [])
      .filter((c) => c.gymId === gymId)
      .map((c) => c.memberId)
  }

  async listSubjectsForReconcile(
    gymId: string
  ): Promise<MemberAccessContext[]> {
    return (this.options.contexts ?? []).filter((c) => c.gymId === gymId)
  }

  async listGymsWithAccessControl(): Promise<string[]> {
    return this.options.gymsWithAccessControl ?? []
  }

  async listEvictionCandidates(_gymId: string): Promise<EvictionCandidate[]> {
    return this.options.evictionCandidates ?? []
  }

  async markSubjectOffDevice(memberId: string): Promise<void> {
    this.offDevice.push(memberId)
  }

  async recountDeviceTemplates(deviceId: string): Promise<number> {
    this.recounted.push(deviceId)

    // Returns the device's recorded count, which is where a real recount
    // converges when nothing has changed. Returning a flat zero made the fake
    // lie in the one direction that matters — capacity learning reads this
    // number, and zero reads as "nothing to measure".
    return (
      (this.options.devices ?? []).find((d) => d.id === deviceId)
        ?.template_count ?? 0
    )
  }

  async allocateSubjectId(): Promise<number> {
    return this.nextSubjectId++
  }

  async createSubject(
    gymId: string,
    memberId: string,
    subjectId: number
  ): Promise<MemberAccessSubject> {
    return makeSubject({
      gym_id: gymId,
      member_id: memberId,
      subject_id: subjectId,
      provisioned_at: null,
      on_device: false,
      finger_enrolled: false,
    })
  }

  async updateSyncState(
    memberId: string,
    update: SyncStateUpdate
  ): Promise<void> {
    this.syncStates.set(memberId, update)
  }

  async setBiometricEnrolled(
    memberId: string,
    enrolled: boolean,
    fingerId?: number | null
  ): Promise<void> {
    this.enrolments.push({ memberId, enrolled, fingerId: fingerId ?? null })
  }

  /**
   * Conditional exactly as the real one is.
   *
   * The double has to model the `.eq('finger_enrolled', false)` clause, or the
   * "one write however many scans" property would be tested against a fake
   * that cannot fail it — the lesson this feature has now learned four times.
   */
  async confirmBiometricEnrolmentFromScan(
    memberId: string,
    observedAt: Date
  ): Promise<boolean> {
    const subject = (this.options.contexts ?? []).find(
      (c) => c.memberId === memberId
    )?.subject

    if (!subject || subject.finger_enrolled) return false

    // Actually flips the fixture, so a second scan finds the state the first
    // one left — the condition IS the behaviour under test.
    subject.finger_enrolled = true
    subject.enrolled_at = observedAt.toISOString()

    this.scanConfirmedEnrolments.push(memberId)
    return true
  }

  // ---- Outbox --------------------------------------------------------------

  async enqueue(
    gymId: string,
    memberId: string | null,
    intent: string,
    payload?: Record<string, unknown>,
    notBefore?: Date
  ): Promise<void> {
    this.enqueued.push({
      gymId,
      memberId,
      intent,
      payload,
      // Only when given, so a plain `toEqual` on an ordinary job stays exact.
      ...(notBefore ? { notBefore } : {}),
    })
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
    for (const job of jobs) {
      await this.enqueue(
        gymId,
        job.memberId,
        job.intent,
        job.payload,
        job.notBefore
      )
    }
    return jobs.length
  }

  async claimDueJobs(limit: number): Promise<AccessSyncJob[]> {
    // One batch only: the drainer claims once per run, and returning the same
    // jobs again would let a test loop forever.
    if (this.claimed) return []
    this.claimed = true

    // What a test seeded as claimable, plus anything enqueued so far, minus
    // jobs still waiting for their time — the real claim function filters on
    // `next_attempt_at <= now()` too. A fake that ignored it would let a
    // delayed repair run the moment it was queued and still pass.
    const now = Date.now()
    const queued = this.enqueued
      .filter((job) => !job.notBefore || job.notBefore.getTime() <= now)
      .map((job, n) =>
        makeJob({
          id: `queued-${n}`,
          gym_id: job.gymId,
          member_id: job.memberId,
          intent: job.intent as AccessSyncJob['intent'],
          payload: job.payload ?? {},
        })
      )

    return [...(this.options.claimable ?? []), ...queued].slice(0, limit)
  }

  async completeJob(jobId: string, status: AccessSyncStatus): Promise<void> {
    this.settled.push({ jobId, outcome: 'completed', status })
  }

  async failJob(
    jobId: string,
    error: string,
    retryable: boolean
  ): Promise<void> {
    this.settled.push({ jobId, outcome: 'failed', error, retryable })
  }

  async recordBiometricConsent(memberId: string, at: Date): Promise<void> {
    this.consentWrites.push({ memberId, at })

    // Mirrors the real repository's `.is(..., null)` guard: a member who
    // already consented keeps their original timestamp. A fake that restamped
    // would hide exactly the regression the guard exists to prevent.
    const context = (this.options.contexts ?? []).find(
      (c) => c.memberId === memberId
    )

    if (context && context.biometricConsentAt === null) {
      context.biometricConsentAt = at
    }
  }

  async clearBiometricConsent(memberId: string): Promise<void> {
    this.consentClears.push(memberId)

    const context = (this.options.contexts ?? []).find(
      (c) => c.memberId === memberId
    )

    if (context) context.biometricConsentAt = null
  }

  async countDeadJobs(_memberId?: string): Promise<number> {
    return this.options.deadJobs ?? 0
  }

  async countPendingJobs(_memberId: string): Promise<number> {
    return this.options.pendingJobs ?? 0
  }

  async reclaimStaleJobs(_olderThanSeconds: number): Promise<number> {
    return this.options.staleJobs ?? 0
  }

  // ---- Events --------------------------------------------------------------

  async recordEvents(
    _gymId: string,
    events: IncomingAccessEvent[]
  ): Promise<{ inserted: number; duplicates: number }> {
    let inserted = 0
    let duplicates = 0

    for (const event of events) {
      const key = `${event.deviceSerial}|${event.subjectId}|${event.occurredAt.toISOString()}`

      if (this.seenEventKeys.has(key)) {
        duplicates += 1
        continue
      }

      this.seenEventKeys.add(key)
      this.storedEvents.push(event)
      inserted += 1
    }

    return { inserted, duplicates }
  }

  async listEvents(
    _gymId: string,
    query: { page: number; limit: number; memberId?: string }
  ): Promise<{ events: AccessEventWithMember[]; total: number }> {
    const all = this.options.events ?? []
    const from = (query.page - 1) * query.limit

    return {
      events: all
        .slice(from, from + query.limit)
        .map((event) => ({ ...event, memberName: null })),
      total: all.length,
    }
  }

  /**
   * A real bounded delete against the fixture array, not a counter.
   *
   * The tenth finding in this feature's defect history was a fake that
   * returned a convenient constant and hid the bug being hunted. Batching is
   * the whole behaviour under test here, so the double has to actually remove
   * rows, oldest first, and stop at the limit.
   *
   * Filters on **`created_at`**, matching the real repository. Filtering on
   * `occurred_at` here would be the same class of lie: it would let a fixture
   * with a device clock a year out pass a test that the production query
   * fails, which is precisely the defect this column choice exists to avoid.
   */
  async deleteEventsOlderThan(cutoff: Date, limit: number): Promise<number> {
    this.purgeCalls.push({ cutoff, limit })

    const all = this.options.events ?? []

    const doomed = all
      .filter((event) => new Date(event.created_at) < cutoff)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      .slice(0, limit)

    for (const event of doomed) {
      all.splice(all.indexOf(event), 1)
    }

    return doomed.length
  }

  async findGymIdByDeviceSerial(deviceSerial: string): Promise<string | null> {
    const device = await this.findDeviceBySerial(deviceSerial)
    return device?.gym_id ?? null
  }

  async findMemberIdBySubjectId(
    gymId: string,
    subjectId: number
  ): Promise<string | null> {
    return (
      (this.options.contexts ?? []).find(
        (c) => c.gymId === gymId && c.subject?.subject_id === subjectId
      )?.memberId ?? null
    )
  }
}
