/**
 * Access control types.
 *
 * Database row shapes use snake_case to match Supabase; anything crossing an
 * API boundary is serialized separately (rule 2.11) rather than handed to JSON
 * raw.
 */

import type {
  AccessIntent,
  AccessSyncStatus,
} from '@/features/access-control/config/AccessControlConfig'

/** Per-gym vendor account, non-secret half. Readable by the gym owner. */
export interface AccessControlAccount {
  id: string
  gym_id: string
  base_url: string
  /** Vendor AreaID. Organisational only — not a security boundary. */
  area_id: number | null
  is_active: boolean
  last_verified_at: string | null
  created_at: string
  updated_at: string
}

/** A physical terminal. */
export interface AccessDevice {
  id: string
  gym_id: string
  /** Hardware serial; globally unique, and how webhook events find their gym. */
  device_serial: string
  device_name: string
  area_id: number | null
  /** Minutes from UTC as the device reports it (330 = UTC+5:30). */
  timezone_offset_minutes: number
  is_active: boolean
  last_seen_at: string | null
  last_synced_at: string | null
  /**
   * Templates the reader holds, as counted from our own subject rows.
   *
   * Recounted rather than incremented, so a partial eviction run cannot leave
   * the figure drifting away from reality.
   */
  template_count: number
  /**
   * What the reader holds in total, or `null` until we learn it.
   *
   * Unknown capacity means eviction stays its hand — we find the real limit
   * from a `-18` (device storage full), and guessing could evict members from
   * a reader with plenty of room.
   */
  template_capacity: number | null
  /** Inferred drift; the expiry cutover runs on this clock. */
  clock_skew_seconds: number | null
  clock_skew_measured_at: string | null
  created_at: string
  updated_at: string
}

/** A member's identity on the hardware, plus the last state we pushed. */
export interface MemberAccessSubject {
  id: string
  gym_id: string
  member_id: string
  /** ZKTeco Pin. Allocated from the global sequence, capped at 79,999,999. */
  subject_id: number
  finger_enrolled: boolean
  finger_id: number | null
  enrolled_at: string | null
  provisioned_at: string | null
  /**
   * Serials of the readers currently holding this member's template.
   *
   * The authority for whether a push is needed. Per reader, because templates
   * live on each terminal independently — a gym with two entrances has readers
   * holding different sets of members.
   *
   * Distinct from `provisioned_at` (vendor-side) and from `finger_enrolled`
   * (whether a template exists at all). Cancellation and capacity eviction
   * empty this while leaving the other two intact — that separation is what
   * lets a returning member be restored without going back to the scanner.
   */
  synced_device_serials: string[]
  /**
   * DERIVED by the database from `synced_device_serials`: whether any reader
   * holds this member. Read-only — never write it.
   */
  on_device: boolean
  last_synced_at: string | null
  /** What we believe the terminal currently holds — the reconcile diff basis. */
  last_synced_valid_from: string | null
  last_synced_valid_to: string | null
  last_synced_blocked: boolean | null
  created_at: string
  updated_at: string
}

/** One queued intent in the outbox. */
export interface AccessSyncJob {
  id: string
  gym_id: string
  member_id: string | null
  device_id: string | null
  intent: AccessIntent
  payload: Record<string, unknown>
  status: AccessSyncStatus
  attempts: number
  next_attempt_at: string
  last_error: string | null
  provider_command_id: string | null
  created_at: string
  updated_at: string
}

/** A successful entry, as pushed by the terminal. */
export interface AccessEvent {
  id: string
  gym_id: string
  member_id: string | null
  device_serial: string
  subject_id: number
  occurred_at: string
  verify_type: number | null
  /** Advisory only — a single reader cannot tell direction reliably. */
  checking_status: number | null
  event_code: string | null
  raw: Record<string, unknown>
  created_at: string
}

// Vendor credentials are deliberately NOT redeclared here. The shape is owned
// by the port in `@/lib/access-control` (`AccessCredentials`) — duplicating it
// would give two definitions that could drift apart, which is the failure R5
// exists to prevent. Import it from the port.

/** Staff-facing access state for one member. Sanitized (rules 2.8/2.9). */
export interface MemberAccessStatus {
  memberId: string
  subjectId: number | null
  /** Whether the member should currently be admitted. */
  allowed: boolean
  /** Plain-language explanation; never a vendor error string. */
  explanation: string
  fingerEnrolled: boolean
  validFrom: string | null
  validTo: string | null
  /** True while changes are queued for the hardware — pending, not failed. */
  syncPending: boolean
  /**
   * True when a change gave up before reaching the hardware.
   *
   * The counterpart to `syncPending`, and the reason both exist. Without it a
   * member whose job exhausted its retries reads as allowed with nothing
   * queued — a green tick on the screen and a door that stays shut. Pending is
   * not failure, but failure is not "fine" either.
   */
  syncFailed: boolean
}
