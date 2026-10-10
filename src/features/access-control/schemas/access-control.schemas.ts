/**
 * Zod schemas for access-control API inputs.
 *
 * Domain enums are validated with `z.nativeEnum()` against the config module,
 * never re-declared as a duplicate `z.enum()` set (rule 2.2 / R5).
 */

import { z } from 'zod'
import {
  MAX_SUBJECT_ID,
  VerifyType,
  CheckingStatus,
} from '@/features/access-control/config/AccessControlConfig'
import { DeviceEventKind } from '@/features/access-control/config/DeviceEventCodes'

/** Vendor credentials submitted by a gym owner. Write-only — never read back. */
export const accessControlAccountSchema = z.object({
  // The account's email and password are sent here on every sign-in, so the
  // address must be encrypted. The one exception is the hardware console's own
  // stub on this machine (remote day F-08).
  baseUrl: z
    .string()
    .url('Must be a valid URL')
    .refine((value) => {
      let url: URL
      try {
        url = new URL(value)
      } catch {
        // Not a URL at all: `.url()` above has already said so, and zod still
        // runs this check after it. Throwing here would turn bad input into a
        // 500 instead of a validation error.
        return true
      }

      const { protocol, hostname } = url
      return (
        protocol === 'https:' ||
        (protocol === 'http:' &&
          (hostname === 'localhost' || hostname === '127.0.0.1'))
      )
    }, 'The VFT address must start with https://'),
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
  areaId: z.number().int().positive().optional(),
})

export type AccessControlAccountInput = z.infer<
  typeof accessControlAccountSchema
>

/** Registering a terminal we already know exists on the vendor side. */
export const registerDeviceSchema = z.object({
  // Trimmed before validation: a serial is read off a label and pasted, and
  // surrounding whitespace would otherwise fail the pattern with "must be
  // alphanumeric", which describes neither the problem nor the fix.
  //
  // Upper-cased because vendors print and send serials in capitals; a
  // lower-case copy was a second reader that matched no scan (remote day F-07).
  deviceSerial: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
    z
      .string()
      .min(1)
      .max(64)
      // Serials are alphanumeric; rejecting anything else keeps a hostile
      // value out of a URL path we build against the vendor API.
      .regex(/^[A-Za-z0-9_-]+$/, 'Serial must be alphanumeric')
  ),
  deviceName: z.string().min(1).max(100),
  areaId: z.number().int().positive().optional(),
  timezoneOffsetMinutes: z.number().int().min(-720).max(840).optional(),
})

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>

/** Renaming a device. Non-state property only — state has its own endpoints. */
export const updateDeviceSchema = z.object({
  deviceName: z.string().min(1).max(100).optional(),
  /**
   * How many templates this reader holds, from its spec sheet.
   *
   * Optional because we also learn it the hard way — a reader answering `-18`
   * tells us its real limit. But that only happens once a gym has filled a
   * reader, so without a way to enter it the capacity bar shows nothing and
   * the proactive eviction sweep cannot fire at all on day one.
   *
   * Bounded to the range these terminals actually ship with, so a mistyped
   * figure cannot make the eviction thresholds nonsensical.
   */
  templateCapacity: z.number().int().min(100).max(100_000).optional(),
})

export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>

/** Optional desk-initiated enrolment trigger. */
export const enrolBiometricSchema = z.object({
  deviceId: z.string().uuid(),
  fingerId: z.number().int().min(0).max(9).optional(),
  /**
   * The member agreed, at the desk, to their fingerprint being recorded.
   *
   * Optional rather than required because a member who consented on a previous
   * enrolment does not consent again — the service checks what is on file and
   * only needs this when nothing is. Deliberately not defaulted to `true`: an
   * absent field must mean "not given", never "assume yes".
   */
  consent: z.boolean().optional(),
})

export type EnrolBiometricInput = z.infer<typeof enrolBiometricSchema>

/**
 * Normalise a vendor scalar to a trimmed string.
 *
 * The collection's `WebhookCheck` example sends every value as a string,
 * including the numeric codes — but that is one hand-written example, and the
 * live device API proved on 2026-09-22 that this vendor's JSON mixes numbers
 * and strings freely and uses `null` liberally (13 of 27 fields on a working
 * reader). A scan is pushed once and never re-sent, so parsing strictly here
 * does not cause a retry: it causes a permanent, silent hole in the check-in
 * history. Coercing costs nothing and cannot lose a scan.
 *
 * `null` and `undefined` are passed through untouched so the surrounding
 * schema decides whether the field was required.
 */
const vendorScalar = (value: unknown): unknown =>
  typeof value === 'number'
    ? String(value)
    : typeof value === 'string'
      ? value.trim()
      : value

/** A vendor field we cannot use the event without. */
const requiredVendorString = z.preprocess(vendorScalar, z.string().min(1))

/**
 * A vendor field we can do without.
 *
 * `null` is folded to `undefined` because the wrapper sends explicit nulls for
 * absent values, and `.optional()` alone rejects them — the same mismatch that
 * emptied a two-reader device list (master §6 V1).
 */
const optionalVendorString = z.preprocess(
  (value) => (value === null ? undefined : vendorScalar(value)),
  z.string().optional()
)

/**
 * One attendance record as the terminal platform pushes it.
 *
 * Unknown keys are preserved by the caller into `access_events.raw` — this
 * schema extracts, it does not gatekeep the payload's shape beyond what we
 * read.
 */
export const accessWebhookEventSchema = z.object({
  EmpId: requiredVendorString,
  AttTime: requiredVendorString,
  // The one field whose spelling differs from every request in the collection:
  // requests use `DevSN`, the webhook alone uses `DeviceID`.
  DeviceID: requiredVendorString,
  CheckingStatus: optionalVendorString,
  VerifyType: optionalVendorString,
  Event: optionalVendorString,
})

export type AccessWebhookEvent = z.infer<typeof accessWebhookEventSchema>

/**
 * The webhook body: an array of events.
 *
 * The terminal batches, so a single delivery can carry many scans — and a
 * single bare event is accepted too. The collection documents an array and
 * that is what we expect; accepting one unwrapped object costs a line and
 * removes a failure mode whose symptom is that nothing arrives, ever, with
 * nothing logged anywhere.
 *
 * Elements are deliberately **not** validated here. `RecordAccessEvents`
 * parses them one at a time, so that one unusable scan cannot discard the
 * batch it was delivered in.
 */
export const accessWebhookPayloadSchema = z.union([
  z.array(z.unknown()),
  z.record(z.string(), z.unknown()).transform((event) => [event as unknown]),
])

/** A subject id must fit the documented ZKTeco Personnel ID range. */
export const subjectIdSchema = z
  .number()
  .int()
  .positive()
  .max(
    MAX_SUBJECT_ID,
    `Subject id exceeds the device limit of ${MAX_SUBJECT_ID}`
  )

/** Verify-type code, when the device sends a recognised one. */
export const verifyTypeSchema = z.nativeEnum(VerifyType)

/** Check-in/out code. Advisory: a single reader cannot tell direction. */
export const checkingStatusSchema = z.nativeEnum(CheckingStatus)

/** Paging and filtering for the check-in log. */
export const accessEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  memberId: z.string().uuid().optional(),
  /**
   * Narrow to one kind of event — the All / Entries / Refusals / Alerts filter.
   *
   * Validated against the domain enum rather than a duplicate string union
   * (rule 2.2), so a new event kind cannot be filterable in one place and
   * unknown in another.
   */
  kind: z.nativeEnum(DeviceEventKind).optional(),
})

export type AccessEventsQuery = z.infer<typeof accessEventsQuerySchema>
