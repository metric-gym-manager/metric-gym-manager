/**
 * Access Control Configuration — Single Source of Truth
 *
 * Domain constants and enums for the biometric access-control integration
 * (VFT GYM API, a REST wrapper over ZKTeco's PUSH/ADMS protocol).
 *
 * Owned exclusively by this feature (R5). Nothing here duplicates a member,
 * payment or subscription concept — those are imported from their owning
 * feature.
 *
 * Evidence grades for the values below are recorded in
 * `docs/integrations/vft/vft-api-assumptions.md`.
 */

/**
 * Upper bound on a ZKTeco Personnel ID (`Pin`), which is what `EmpId` maps to.
 *
 * ZKBioSecurity documents the Personnel ID as numeric, max 9 characters, valid
 * range 1..79,999,999. We hard-cap at the documented ceiling rather than at
 * 999,999,999 because exceeding it is a silent, per-firmware failure.
 *
 * SQL mirror: the MAXVALUE of `access_subject_id_seq` and the CHECK constraint
 * on `member_access_subjects.subject_id` (migration 20260810000001). Keep in
 * lock-step.
 */
export const MAX_SUBJECT_ID = 79_999_999

/**
 * IANA timezone the gyms operate in.
 *
 * The access decision is a calendar-day comparison, and the terminal enforces
 * the cutover at *its* local midnight. Computing "today" in server-local time
 * (UTC on Vercel) would move the boundary by 5.5 hours.
 *
 * Sri Lanka has no DST, so this offset is stable year-round.
 */
export const GYM_TIMEZONE = 'Asia/Colombo'

/**
 * How a member's access can be denied.
 *
 * Used for staff-facing explanation. These are OUR reasons, derived from our
 * own records — the terminal never tells us why it refused someone.
 */
export enum AccessDenialReason {
  /** Paid-through date has passed. */
  Expired = 'expired',
  /** Administratively suspended. */
  Suspended = 'suspended',
  /** Membership cancelled. */
  Cancelled = 'cancelled',
  /** QR self-registration not yet verified at the desk. */
  Unverified = 'unverified',
  /** Membership has not started yet (future start date). */
  NotStarted = 'not_started',
}

/**
 * What we want the hardware to do for a member.
 *
 * Enqueued into `access_sync_jobs.intent` and drained in order, serialized per
 * member: the ZKTeco user profile must exist on the device before a validity
 * period will bind to it.
 */
export enum AccessIntent {
  /** Create/update the employee record on the VFT platform. */
  Provision = 'provision',
  /** Push the employee to a specific terminal. */
  SyncToDevice = 'sync_to_device',
  /** Set the paid-through validity window. */
  SetValidPeriod = 'set_valid_period',
  /** Immediate block (suspension/cancellation). */
  Block = 'block',
  /** Lift a block. */
  Grant = 'grant',
  /** Clear the fingerprint but keep the membership record. */
  RevokeBiometric = 'revoke_biometric',
  /** Remove the employee entirely. */
  RemoveSubject = 'remove_subject',
  /** Recompute and push whatever differs. Enqueued by the members trigger. */
  ReconcileMember = 'reconcile_member',
  /** Remote unlock. Device-level, so it carries no member. */
  OpenDoor = 'open_door',
  /** Remote restart. Device-level. */
  RebootDevice = 'reboot_device',
}

/** Lifecycle of an outbox job. Mirrors the `access_sync_status` SQL enum. */
export enum AccessSyncStatus {
  Pending = 'pending',
  InFlight = 'in_flight',
  Succeeded = 'succeeded',
  Failed = 'failed',
  /** Retry budget exhausted. Surfaced to SaaS admins, never auto-retried. */
  Dead = 'dead',
}

/**
 * ZKTeco attendance `VerifyType` — how the person identified themselves.
 *
 * Source: ZKTeco attendance-log structure (see assumptions doc, A8).
 */
export enum VerifyType {
  Password = 0,
  Fingerprint = 1,
  Card = 2,
  Face = 15,
}

/**
 * ZKTeco attendance `State` (the VFT payload calls it `CheckingStatus`).
 *
 * ⚠️ ADVISORY ONLY. A single reader serving both entry and exit reports the
 * mode it is configured in, not the direction the person actually walked. We
 * model events as visits and never pair them into sessions or derive
 * time-in-gym from them — that would be inventing data the hardware lacks.
 */
export enum CheckingStatus {
  CheckIn = 0,
  CheckOut = 1,
  BreakOut = 2,
  BreakIn = 3,
  OvertimeIn = 4,
  OvertimeOut = 5,
}

/**
 * Retry backoff for outbox jobs, in seconds.
 *
 * Deliberately short at the start (a terminal polls roughly every 30s, so a
 * transient failure often clears immediately) and capped well under the daily
 * reconcile so a stuck job is retried several times before anyone looks at it.
 */
export const SYNC_RETRY_BACKOFF_SECONDS = [30, 120, 600, 1_800, 7_200] as const

/** Attempts before a job is dead-lettered for SaaS-admin attention. */
export const SYNC_MAX_ATTEMPTS = SYNC_RETRY_BACKOFF_SECONDS.length

/**
 * Requests per second we allow ourselves against the vendor API.
 *
 * No published limit exists. There is no bulk validity endpoint, so a large
 * gym's reconcile is one call per changed member; pacing keeps that from
 * looking like an attack.
 */
export const VENDOR_MAX_REQUESTS_PER_SECOND = 5

/**
 * Device clock drift beyond which we raise an alert.
 *
 * The expiry cutover is evaluated against the terminal's own RTC, so drift
 * moves the lockout boundary. The PUSH API exposes no way to read device time,
 * so we infer it from attendance-event timestamps instead.
 */
export const DEVICE_CLOCK_SKEW_ALERT_SECONDS = 300

/**
 * How long an in-flight job may sit before a later drain reclaims it.
 *
 * Longer than a healthy drain run, so a slow-but-alive worker is never robbed
 * of its own job; far shorter than anyone would notice at a door.
 *
 * SQL mirror: the default on `reclaim_stale_access_sync_jobs`.
 */
export const STALE_JOB_RECLAIM_SECONDS = 600

/** Jobs claimed per drain run. */
export const DRAIN_BATCH_SIZE = 25

/**
 * Reader usage above which the nightly reconcile evicts inactive members,
 * and the level it frees down to.
 *
 * Two thresholds rather than one so a gym sitting at the limit does not
 * re-run eviction every single night for the sake of a handful of slots.
 */
export const DEVICE_CAPACITY_EVICT_ABOVE = 0.85
export const DEVICE_CAPACITY_TARGET = 0.7

/**
 * How long since last contact before a reader is presented as offline.
 *
 * VFT quoted a 2-minute device timeout, so this is that plus headroom for one
 * missed poll — a reader that misses a single beat should not flicker offline
 * on the dashboard.
 *
 * Being generous here is the safe direction. Showing a working reader as
 * offline invites staff to start letting people in manually, which is a worse
 * outcome than showing a dead reader as online for another three minutes.
 */
export const DEVICE_OFFLINE_AFTER_SECONDS = 300
