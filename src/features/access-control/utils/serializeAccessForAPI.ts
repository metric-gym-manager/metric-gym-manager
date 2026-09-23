/**
 * API serialization for access-control records (rule 2.11).
 *
 * A database row is never handed to `JSON` directly. Two reasons here beyond
 * the usual camelCase contract:
 *
 *  - **Secrets must not leak by accident.** The account row is adjacent to
 *    credentials in the reader's mind; serializing explicitly means a column
 *    added to the table later cannot appear in a response nobody re-reviewed.
 *  - **Vendor detail must not reach a gym manager** (rule 2.9). Device rows
 *    carry inferred clock skew and sync bookkeeping; what the dashboard gets is
 *    a plain "online / last seen" reading.
 */

import type {
  AccessControlAccount,
  AccessDevice,
  AccessEvent,
} from '@/features/access-control/types'
import {
  describeDeviceEvent,
  classifyDeviceEvent,
} from '@/features/access-control/config/DeviceEventCodes'
import {
  ACCOUNT_VERIFICATION_TTL_HOURS,
  DEVICE_CLOCK_SKEW_ALERT_SECONDS,
  DEVICE_OFFLINE_AFTER_SECONDS,
} from '@/features/access-control/config/AccessControlConfig'

export interface SerializedAccessAccount {
  id: string
  baseUrl: string
  areaId: number | null
  isActive: boolean
  /**
   * Whether a sign-in probe succeeded **recently**.
   *
   * Not "ever". A check is evidence about a moment, and the moment expires —
   * see {@link ACCOUNT_VERIFICATION_TTL_HOURS}. Read together with
   * `lastVerifiedAt`, the two describe three states: connected, worked once
   * but not lately, and never confirmed at all.
   */
  verified: boolean
  /** When a probe last succeeded, kept even once it has gone stale. */
  lastVerifiedAt: string | null
}

/**
 * The gym's vendor account, minus anything secret.
 *
 * Credentials are write-only by design: they are never read back, not even to
 * the owner who typed them.
 */
export function serializeAccessAccountForAPI(
  account: AccessControlAccount
): SerializedAccessAccount {
  return {
    id: account.id,
    baseUrl: account.base_url,
    areaId: account.area_id,
    isActive: account.is_active,
    verified: isVerificationFresh(account.last_verified_at),
    lastVerifiedAt: account.last_verified_at,
  }
}

/**
 * Whether a recorded success is recent enough to still mean anything.
 *
 * An unparseable timestamp counts as stale: a date we cannot read is not
 * evidence, and the safe direction here is to under-claim.
 */
function isVerificationFresh(lastVerifiedAt: string | null): boolean {
  if (!lastVerifiedAt) return false

  const at = new Date(lastVerifiedAt).getTime()
  if (Number.isNaN(at)) return false

  return Date.now() - at < ACCOUNT_VERIFICATION_TTL_HOURS * 60 * 60 * 1000
}

export interface SerializedAccessDevice {
  id: string
  deviceSerial: string
  deviceName: string
  areaId: number | null
  timezoneOffsetMinutes: number
  isActive: boolean
  lastSeenAt: string | null
  templateCount: number
  templateCapacity: number | null
  /** Fraction of the reader's capacity in use, or `null` if unknown. */
  capacityUsed: number | null
  /** True when the reader's clock has drifted far enough to matter. */
  clockDrifting: boolean
  /**
   * Presence, with "we don't know" as a first-class answer.
   *
   * `unknown` is not a failure state and must not render like one: it means we
   * have simply never heard from this reader, which is the normal state of a
   * device registered minutes ago.
   */
  presence: 'online' | 'offline' | 'unknown'
}

/**
 * One reader, as the dashboard sees it.
 *
 * Clock skew becomes a boolean rather than a number of seconds: the manager's
 * question is "is something wrong with this reader", and the exact drift is a
 * SaaS-admin diagnostic.
 */
export function serializeAccessDeviceForAPI(
  device: AccessDevice
): SerializedAccessDevice {
  const capacity = device.template_capacity

  return {
    id: device.id,
    deviceSerial: device.device_serial,
    deviceName: device.device_name,
    areaId: device.area_id,
    timezoneOffsetMinutes: device.timezone_offset_minutes,
    isActive: device.is_active,
    lastSeenAt: device.last_seen_at,
    templateCount: device.template_count,
    templateCapacity: capacity,
    capacityUsed:
      capacity && capacity > 0 ? device.template_count / capacity : null,
    clockDrifting:
      device.clock_skew_seconds !== null &&
      Math.abs(device.clock_skew_seconds) > DEVICE_CLOCK_SKEW_ALERT_SECONDS,
    presence: resolvePresence(device.last_seen_at),
  }
}

/**
 * Turn a last-contact time into the verdict shown on the card.
 *
 * Three outcomes, not two. A reader we have never heard from is `unknown` —
 * newly registered, or one whose gym has had no scans and whose vendor gives
 * no presence field. Rendering that as "offline" would be a false alarm on the
 * one screen whose job is to prevent exactly that.
 *
 * @param lastSeenAt - ISO contact time, or `null` if never.
 */
function resolvePresence(
  lastSeenAt: string | null
): 'online' | 'offline' | 'unknown' {
  if (!lastSeenAt) return 'unknown'

  const elapsedSeconds = (Date.now() - new Date(lastSeenAt).getTime()) / 1000

  return elapsedSeconds <= DEVICE_OFFLINE_AFTER_SECONDS ? 'online' : 'offline'
}

export interface SerializedAccessEvent {
  id: string
  memberId: string | null
  /**
   * Who it was, when we can tell.
   *
   * `null` is a real and expected answer: an unrecognised finger has no
   * subject to resolve, and those rows are how a gym notices someone trying
   * their luck. The log shows them rather than hiding them.
   */
  memberName: string | null
  deviceSerial: string
  occurredAt: string
  verifyType: number | null
  checkingStatus: number | null
  /** Plain-language description of the device's own event code. */
  description: string
  kind: string
}

/**
 * One check-in.
 *
 * `raw` is deliberately not exposed: it is the vendor's payload verbatim, kept
 * for diagnosis, and belongs on the admin health view rather than in a gym's
 * check-in log.
 */
export function serializeAccessEventForAPI(
  event: AccessEvent & { memberName?: string | null }
): SerializedAccessEvent {
  // The column is text because the device sends strings; an event we cannot
  // read as a code still gets a description, via the code tables' own fallback.
  const code = Number(event.event_code)
  const known = Number.isFinite(code) ? code : UNKNOWN_EVENT_CODE

  return {
    id: event.id,
    memberId: event.member_id,
    memberName: event.memberName ?? null,
    deviceSerial: event.device_serial,
    occurredAt: event.occurred_at,
    verifyType: event.verify_type,
    checkingStatus: event.checking_status,
    description: describeDeviceEvent(known),
    kind: classifyDeviceEvent(known),
  }
}

/**
 * Stand-in for an unreadable event code.
 *
 * Negative so it can never collide with a real vendor code, all of which are
 * non-negative. It falls through the tables to the "Other" description.
 */
const UNKNOWN_EVENT_CODE = -1
