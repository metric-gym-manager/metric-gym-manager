/**
 * Access control repository (port).
 *
 * ## The tenant-scoping invariant lives behind this interface
 *
 * The vendor API grants administrative reach across every area on an account —
 * `AreaID` is an organisational label, not an authorization barrier. So on a
 * shared account our own scoping is the only thing standing between one gym and
 * another gym's members and doors.
 *
 * Every method therefore takes identifiers that the caller resolved from *our*
 * database under RLS. Nothing here accepts a vendor identifier that arrived on
 * a request, and implementations must never widen a query beyond the gym they
 * were given.
 */

import type { MemberStatus } from '@/features/members/config/StatusConfig'
import type { RegistrationSource } from '@/features/members/config/RegistrationConfig'
import type { AccessCredentials } from '@/lib/access-control'
import type { AccessSyncStatus } from '@/features/access-control/config/AccessControlConfig'
import type {
  AccessControlAccount,
  AccessDevice,
  AccessEvent,
  AccessSyncJob,
  MemberAccessSubject,
} from '@/features/access-control/types'

/** Everything needed to decide and sync one member, resolved in a single read. */
export interface MemberAccessContext {
  memberId: string
  gymId: string
  memberName: string
  status: MemberStatus
  membershipStartDate: Date
  nextDueDate: Date
  registrationSource: RegistrationSource
  verifiedAt: Date | null
  /** `null` until the member is first provisioned to hardware. */
  subject: MemberAccessSubject | null
}

/** State to persist after a successful push. */
export interface SyncStateUpdate {
  /** Subject record exists on the vendor platform. */
  provisioned: boolean
  /**
   * Readers that now hold the member's template — the complete set, not a
   * delta. Empty means no reader holds them.
   */
  syncedDeviceSerials: string[]
  validFrom: string | null
  validTo: string | null
  blocked: boolean
}

/** A subject eligible for capacity eviction, with what the ordering needs. */
export interface EvictionCandidate {
  memberId: string
  subjectId: number
  status: MemberStatus
  /** Paid-through date; how long-expired a member is orders the queue. */
  nextDueDate: Date
}

/** A normalised inbound scan, ready to store. */
export interface IncomingAccessEvent {
  deviceSerial: string
  subjectId: number
  /**
   * The member this scan belongs to, resolved from OUR subject mapping.
   *
   * `null` when the subject id maps to nothing we know — which is real: a
   * template can outlive the member row that owned it.
   */
  memberId: string | null
  occurredAt: Date
  verifyType: number | null
  checkingStatus: number | null
  eventCode: string | null
  raw: Record<string, unknown>
}

export interface IAccessControlRepository {
  // ---- Account -------------------------------------------------------------

  /** The gym's vendor account, or `null` if access control is not configured. */
  findAccountByGymId(gymId: string): Promise<AccessControlAccount | null>

  /**
   * Decrypted credentials for a gym.
   *
   * Service-role only: the secrets table has RLS enabled with no policies, so a
   * session client cannot reach it even by accident.
   */
  getCredentials(gymId: string): Promise<AccessCredentials | null>

  /** Store credentials, encrypting them at rest. */
  saveCredentials(
    gymId: string,
    input: {
      baseUrl: string
      email: string
      password: string
      areaId?: number | null
    }
  ): Promise<AccessControlAccount>

  /** Record that a credential probe succeeded. */
  markAccountVerified(gymId: string): Promise<void>

  // ---- Devices -------------------------------------------------------------

  listDevices(gymId: string): Promise<AccessDevice[]>

  /**
   * One device, scoped to its gym.
   *
   * Takes `gymId` and not just the device id on purpose: the vendor token
   * reaches every terminal on the account, so resolving the device against the
   * caller's own gym is the tenant boundary for every device operation.
   */
  findDeviceById(gymId: string, deviceId: string): Promise<AccessDevice | null>

  /** Serials of the gym's active terminals — the targets for every command. */
  listActiveDeviceSerials(gymId: string): Promise<string[]>

  findDeviceBySerial(deviceSerial: string): Promise<AccessDevice | null>

  registerDevice(
    gymId: string,
    input: {
      deviceSerial: string
      deviceName: string
      areaId?: number | null
      timezoneOffsetMinutes?: number
    }
  ): Promise<AccessDevice>

  setDeviceActive(deviceId: string, isActive: boolean): Promise<void>

  renameDevice(deviceId: string, deviceName: string): Promise<void>

  /** Remove from our records only — the vendor exposes no device delete. */
  unlinkDevice(deviceId: string): Promise<void>

  /** Persist inferred clock drift for monitoring. */
  recordDeviceClockSkew(
    deviceSerial: string,
    skewSeconds: number
  ): Promise<void>

  // ---- Subjects ------------------------------------------------------------

  getMemberAccessContext(memberId: string): Promise<MemberAccessContext | null>

  /**
   * Members whose access may have changed, for the nightly reconcile.
   *
   * Returns ids only; prefer `listSubjectsForReconcile` when the caller needs
   * to diff, since that avoids a query per member.
   */
  listMembersNeedingReconcile(gymId: string): Promise<string[]>

  /**
   * Full context for every provisioned member of a gym.
   *
   * The reconciler diffs in memory against `last_synced_*` rather than issuing
   * a query per member — there is no bulk validity endpoint, so the point of
   * the diff is to keep vendor traffic proportional to real changes.
   */
  listSubjectsForReconcile(gymId: string): Promise<MemberAccessContext[]>

  /**
   * Gyms with access control configured and active.
   *
   * The reconciler has no other way to find its work.
   */
  listGymsWithAccessControl(): Promise<string[]>

  /**
   * Subjects on the reader that could be evicted to reclaim capacity.
   *
   * Only members who cannot currently enter. Active members are never
   * candidates and implementations must not return them.
   */
  listEvictionCandidates(gymId: string): Promise<EvictionCandidate[]>

  /** Record that a member's template is no longer on the reader. */
  markSubjectOffDevice(memberId: string): Promise<void>

  /** Recompute how many templates a reader holds. */
  recountDeviceTemplates(deviceId: string): Promise<number>

  /**
   * Allocate the next device identifier from the global sequence.
   *
   * Allocated lazily at first provisioning rather than at registration: the
   * namespace is finite and most members never need one.
   */
  allocateSubjectId(): Promise<number>

  /** Create the local subject row for a member. */
  createSubject(
    gymId: string,
    memberId: string,
    subjectId: number
  ): Promise<MemberAccessSubject>

  /** Record what we believe the hardware now holds. */
  updateSyncState(memberId: string, update: SyncStateUpdate): Promise<void>

  /** Flip the enrolment flag after observing a template on the vendor side. */
  setBiometricEnrolled(
    memberId: string,
    enrolled: boolean,
    fingerId?: number | null
  ): Promise<void>

  // ---- Outbox --------------------------------------------------------------

  enqueue(
    gymId: string,
    memberId: string | null,
    intent: string,
    payload?: Record<string, unknown>
  ): Promise<void>

  /**
   * Claim jobs to work on.
   *
   * Implementations must return **at most one job per member**, oldest first:
   * a member's commands have a required order (the profile must reach the
   * device before a validity period binds to it), so running two concurrently
   * can land them backwards.
   */
  claimDueJobs(limit: number): Promise<AccessSyncJob[]>

  completeJob(jobId: string, status: AccessSyncStatus): Promise<void>

  failJob(jobId: string, error: string, retryable: boolean): Promise<void>

  /**
   * Jobs stuck in `dead`.
   *
   * With no argument: the platform-wide count for the SaaS-admin health view.
   * With a member id: whether that member's access has stopped being applied,
   * which is the difference between "syncing" and "broken" at the front desk.
   */
  countDeadJobs(memberId?: string): Promise<number>

  /**
   * Queued work outstanding for one member.
   *
   * Drives the "pending, not failed" distinction (rule 2.8): a member whose
   * change has not reached the reader yet is in progress, and the front desk
   * must not be shown that as an error.
   */
  countPendingJobs(memberId: string): Promise<number>

  /**
   * Return jobs abandoned by a dead worker to `pending`.
   *
   * Called at the start of every drain, so each run heals the previous run's
   * casualties. Without it a killed invocation strands its claimed jobs in
   * `in_flight` forever and those members never sync again.
   *
   * @returns How many jobs were reclaimed.
   */
  reclaimStaleJobs(olderThanSeconds: number): Promise<number>

  // ---- Events --------------------------------------------------------------

  /** Insert scans, ignoring duplicates. Returns how many were new. */
  recordEvents(
    gymId: string,
    events: IncomingAccessEvent[]
  ): Promise<{ inserted: number; duplicates: number }>

  /** One page of the check-in log, newest first. */
  listEvents(
    gymId: string,
    query: { page: number; limit: number; memberId?: string }
  ): Promise<{ events: AccessEvent[]; total: number }>

  /** Resolve a device serial to its gym — how webhook events are routed. */
  findGymIdByDeviceSerial(deviceSerial: string): Promise<string | null>

  /** Resolve a vendor subject id back to one of our members. */
  findMemberIdBySubjectId(
    gymId: string,
    subjectId: number
  ): Promise<string | null>
}
