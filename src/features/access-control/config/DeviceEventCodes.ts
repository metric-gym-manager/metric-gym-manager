/**
 * ZKTeco access-control event codes.
 *
 * Source: VFT's "Event Codes" reference. These arrive in the `Event` field of
 * the attendance webhook.
 *
 * ## This overturns an earlier design decision
 *
 * The plan previously said refused scans are invisible to us, so
 * `access_events` recorded successful entries only. The event table shows the
 * device emits explicit denial events with a *reason* — expired validity,
 * unregistered finger, locked user, and so on.
 *
 * That is a real capability, not a nicety: the front desk can be told
 * "refused at 18:42 — membership expired" instead of a member insisting the
 * door is broken. Ingestion therefore stores **every** event and classifies it,
 * rather than filtering to successes.
 *
 * Whether VFT forwards denial events over the webhook (as opposed to only
 * attendance records) is still unconfirmed — but storing what arrives costs
 * nothing and is correct either way.
 *
 * ## Merged codes
 *
 * The vendor table notes that several codes are merged and carry identical
 * meaning — they differ only by the credential used (card vs fingerprint vs
 * password), which we do not care about because our members only ever use a
 * fingerprint. `0/14/17`, `1/16`, `2/18/19`, `3/15/203`, `20/31/50`,
 * `21/35/49`, `26/32/51`, `27/30/34`, `29/33/53`, `40/48/52`, `101/103`.
 */

import { AccessDenialReason } from './AccessControlConfig'

/** What a device event means for us. */
export enum DeviceEventKind {
  /** The door opened for someone. */
  Granted = 'granted',
  /** Someone was refused. */
  Denied = 'denied',
  /** Device or door state — used for health, not for the member timeline. */
  System = 'system',
  /** Requires urgent human attention. */
  Alarm = 'alarm',
  /** Recognised code with no product meaning for us. */
  Other = 'other',
}

/**
 * Entry granted.
 *
 * Includes remote unlock (8) and the exit button (202), which open the door
 * without a member being identified — they are still "the door opened".
 */
const GRANTED = new Set([
  0, 1, 2, 3, 4, 5, 8, 14, 15, 16, 17, 18, 19, 202, 203, 207, 208, 209, 215,
  216, 218, 222, 232, 234,
])

/**
 * Entry refused.
 *
 * The valuable half of this table. `21/35/49` and `29/33/53` are the two that
 * an unpaid member produces, which is exactly what we want to show staff.
 */
const DENIED = new Set([
  20, 21, 22, 23, 24, 25, 27, 29, 30, 31, 33, 34, 35, 38, 39, 40, 41, 42, 43,
  44, 45, 48, 49, 50, 52, 53, 56, 59, 61, 62, 63, 67, 68, 69, 73, 74,
])

/**
 * Safety and security alarms.
 *
 * `101/103` is a **duress** code — the member opened the door under coercion
 * using a duress credential. It must never be buried in a routine event list.
 */
const ALARM = new Set([100, 101, 102, 103, 104, 58, 109, 110])

/** Device, door and connectivity state — feeds health monitoring. */
const SYSTEM = new Set([
  9, 10, 11, 12, 13, 28, 36, 37, 54, 55, 57, 60, 64, 65, 66, 105, 106, 107, 108,
  200, 201, 204, 205, 206, 210, 211, 212, 213, 214, 217, 220, 221, 225, 226,
  227, 228, 229, 230, 235, 236, 237, 239, 240, 255,
])

/**
 * Classify a raw device event code.
 *
 * @param code - The `Event` value from the webhook payload.
 * @returns What kind of event it is.
 *
 * @example
 * classifyDeviceEvent(0)   // => Granted (door opened after verification)
 * classifyDeviceEvent(21)  // => Denied  (outside the valid time period)
 * classifyDeviceEvent(103) // => Alarm   (duress fingerprint)
 */
export function classifyDeviceEvent(code: number): DeviceEventKind {
  if (ALARM.has(code)) return DeviceEventKind.Alarm
  if (GRANTED.has(code)) return DeviceEventKind.Granted
  if (DENIED.has(code)) return DeviceEventKind.Denied
  if (SYSTEM.has(code)) return DeviceEventKind.System
  return DeviceEventKind.Other
}

/**
 * Map a denial event to the reason vocabulary the rest of the app already uses.
 *
 * Lets the member timeline say "refused — membership expired" using the same
 * wording as the access panel, rather than inventing a parallel set of terms.
 *
 * @param code - A device event code.
 * @returns Our denial reason, or `null` if the code is not a denial we model.
 */
export function toDenialReason(code: number): AccessDenialReason | null {
  switch (code) {
    // Verification attempted outside the member's valid period, and the
    // explicit "privilege expired" family. Both mean an unpaid membership.
    case 21:
    case 35:
    case 49:
    case 22:
    case 29:
    case 33:
    case 53:
      return AccessDenialReason.Expired

    // Locked, prohibited or blacklisted — what an administrative block looks
    // like from the device's side.
    case 39:
    case 43:
    case 62:
    case 63:
      return AccessDenialReason.Suspended

    // The finger is not on this device: either never enrolled, or the record
    // was removed when the membership was cancelled.
    case 27:
    case 30:
    case 34:
      return AccessDenialReason.Cancelled

    default:
      return null
  }
}

/**
 * Descriptions for the codes we surface to gym staff.
 *
 * Deliberately plain language and free of device jargon (rules 2.8 / 2.9).
 * Anything not listed falls back to a neutral phrase rather than leaking a
 * firmware string.
 */
const STAFF_DESCRIPTIONS: Record<number, string> = {
  0: 'Entry allowed',
  1: 'Entry allowed',
  8: 'Door opened remotely',
  202: 'Door opened with the exit button',
  232: 'Entry allowed',

  20: 'Scanned again too quickly',
  21: 'Refused — membership not valid on this date',
  22: 'Refused — membership not valid on this date',
  23: 'Refused — no access rights',
  24: 'Refused — already inside',
  27: 'Refused — fingerprint not recognised',
  29: 'Refused — membership expired',
  30: 'Refused — fingerprint not recognised',
  33: 'Refused — membership expired',
  34: 'Refused — fingerprint not recognised',
  35: 'Refused — membership not valid on this date',
  39: 'Refused — member is blocked',
  43: 'Refused — member is locked',
  49: 'Refused — membership not valid on this date',
  53: 'Refused — membership expired',
  62: 'Refused — member is blocked',
  68: 'Refused — temperature check failed',
  69: 'Refused — face covering required',

  100: 'Tamper alarm on the reader',
  101: 'Duress alarm — door opened under coercion',
  103: 'Duress alarm — door opened under coercion',
  105: 'Reader lost its connection',
  107: 'Reader lost mains power',
  110: 'Reader is offline',
  206: 'Reader restarted',
  214: 'Reader reconnected',
}

/**
 * Describe an event for gym staff.
 *
 * @param code - The device event code.
 * @returns A plain-language description with no technical detail.
 */
export function describeDeviceEvent(code: number): string {
  const known = STAFF_DESCRIPTIONS[code]
  if (known) return known

  switch (classifyDeviceEvent(code)) {
    case DeviceEventKind.Granted:
      return 'Entry allowed'
    case DeviceEventKind.Denied:
      return 'Entry refused'
    case DeviceEventKind.Alarm:
      return 'Reader alarm'
    case DeviceEventKind.System:
      return 'Reader status update'
    default:
      return 'Reader event'
  }
}

/**
 * Whether an event should raise an operational alert rather than sit in a log.
 *
 * @param code - The device event code.
 * @returns True for duress, tamper and reader-offline conditions.
 */
export function isUrgentEvent(code: number): boolean {
  return classifyDeviceEvent(code) === DeviceEventKind.Alarm
}
