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
 * How long a successful credential check stands for.
 *
 * A check proves the account worked at that moment; it says nothing about now.
 * Treating one as permanent is how the Access Control card showed "Connected"
 * for twenty-five days while production could not decrypt its own credentials
 * and every nightly job died — the badge was reporting 27 August on
 * 22 September.
 *
 * A day is chosen to match the rhythm of the thing that would break it: the
 * reconciler runs nightly, so a gym in normal use re-confirms itself roughly
 * once a day, and anything older means nobody has heard from the vendor since.
 */
export const ACCOUNT_VERIFICATION_TTL_HOURS = 24

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
 * Seconds after a restart before its members are re-seated.
 *
 * A ZAM70 restart takes about a minute; the repair waits three so it lands on a
 * reader that is back. Visit 1, D1 (PH-15): a restart kept the users and
 * dropped their fingerprints.
 */
export const REBOOT_RESEAT_DELAY_SECONDS = 180

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
 * How often the drain cron runs, and with it the device-presence refresh.
 *
 * Mirrors the five-minute schedule in `vercel.json`. Declared here because
 * `DEVICE_OFFLINE_AFTER_SECONDS` below is only meaningful *relative to it* —
 * see the note there.
 */
export const DRAIN_INTERVAL_SECONDS = 300

/**
 * How long since last contact before a reader is presented as offline.
 *
 * **This must stay comfortably larger than `DRAIN_INTERVAL_SECONDS`**, and
 * that relationship is the whole point of the number. Presence is only
 * refreshed once per drain, so a threshold equal to the refresh interval means
 * every healthy reader spends the tail of every interval reading "offline" —
 * a permanent flicker on the one screen built to prevent false alarms. Three
 * intervals of headroom tolerates a missed run and a slow one.
 *
 * Being generous is the safe direction. Showing a working reader as offline
 * invites staff to start letting people in by hand, which is worse than
 * showing a dead reader as online for another ten minutes — the door keeps
 * enforcing validity from its own clock either way.
 */
export const DEVICE_OFFLINE_AFTER_SECONDS = DRAIN_INTERVAL_SECONDS * 3

/**
 * How often the desk re-checks whether an enrolment has landed.
 *
 * The vendor confirms that a reader *accepted* the request, never that a finger
 * was presented — the template exists only once the member touches the sensor,
 * and no webhook reports it. Polling is the only way to learn it happened.
 *
 * Three seconds because a person is standing there watching a screen, and the
 * poll is bounded by the timeout below rather than running all day.
 */
export const ENROLMENT_POLL_INTERVAL_MS = 3_000

/**
 * How long the desk waits, visibly, for a finger.
 *
 * Thirty seconds. The reader's own enrolment window is about ten seconds (ZAM70,
 * measured on visit 1, PH-21); the rest covers the member's confirming scan.
 *
 * **Timing out is not failure.** The detection behind the poll is additive — it
 * can mark a member enrolled, never un-enrol one — so a member who did present
 * a finger stays correctly enrolled and simply shows it on the next read.
 */
export const ENROLMENT_POLL_TIMEOUT_MS = 30_000

/**
 * After the visible wait ends, the panel keeps checking quietly this long, so
 * the member's first scan flips it to Registered without a reload (visit 1,
 * PH-04).
 */
export const ENROLMENT_CONFIRM_GRACE_MS = 180_000

/**
 * How long a door scan is kept before it is deleted.
 *
 * `access_events` is attendance data about identifiable people — who was at
 * the gym, at what minute, for as long as the row survives. Keeping it forever
 * is a choice, and it was the wrong one: nothing in the product reads an event
 * older than the activity log's own paging, and the privacy policy now states
 * this figure to members.
 *
 * Twelve months rather than something shorter because a gym's own reason to
 * look back — a dispute, a "when did we last see this member" — is seasonal,
 * and rather than something longer because there is no purpose left to serve
 * after that. The number is the promise; keep the two in step if it changes.
 *
 * Measured from when the row was **stored** (`created_at`), never from the
 * device's `occurred_at`. See `deleteEventsOlderThan` — a reader with a reset
 * clock would otherwise have this morning's scans deleted tonight.
 */
export const ACCESS_EVENT_RETENTION_DAYS = 365

/**
 * Rows deleted per statement by the retention purge.
 *
 * Deleted in batches, not one statement, because the first run on a gym that
 * has been collecting for a year deletes everything at once and a single
 * unbounded `DELETE` is how a cron hits a statement timeout and never makes
 * progress at all. Small enough to stay well inside the route's `maxDuration`,
 * large enough that a normal night's handful of rows finishes in one pass.
 */
export const ACCESS_EVENT_PURGE_BATCH_SIZE = 500

/**
 * Batches one purge run will do before stopping.
 *
 * A backlog larger than this is picked up by tomorrow's run rather than
 * risking a timeout that rolls back nothing and reports nothing. The cap is
 * generous enough (250,000 rows) that only a first run after a long backfill
 * would ever reach it, and the summary says when it did.
 */
export const ACCESS_EVENT_PURGE_MAX_BATCHES = 500

/**
 * Ids per `DELETE` statement inside one purge batch.
 *
 * PostgREST has no `DELETE ... LIMIT`, so rows are deleted by primary key and
 * `.in()` puts every id in the **query string**. That makes this a transport
 * limit, not a database one: 100 UUIDs is a ~3.9 KB request line, 200 is
 * ~7.8 KB, and 500 is ~19.5 KB — past the ~8 KB an nginx-family gateway
 * accepts, which comes back as a 414 and fails the entire run.
 *
 * So a purge batch is read in one query and deleted in several. Raising
 * `ACCESS_EVENT_PURGE_BATCH_SIZE` is safe; raising this is not.
 */
export const ACCESS_EVENT_DELETE_CHUNK_SIZE = 100
