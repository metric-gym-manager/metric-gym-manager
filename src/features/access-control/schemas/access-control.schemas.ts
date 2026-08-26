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
  baseUrl: z.string().url('Must be a valid URL'),
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
  areaId: z.number().int().positive().optional(),
})

export type AccessControlAccountInput = z.infer<
  typeof accessControlAccountSchema
>

/** Registering a terminal we already know exists on the vendor side. */
export const registerDeviceSchema = z.object({
  deviceSerial: z
    .string()
    .min(1)
    .max(64)
    // Serials are alphanumeric; rejecting anything else keeps a hostile value
    // out of a URL path we build against the vendor API.
    .regex(/^[A-Za-z0-9_-]+$/, 'Serial must be alphanumeric'),
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
})

export type EnrolBiometricInput = z.infer<typeof enrolBiometricSchema>

/**
 * One attendance record as the terminal platform pushes it.
 *
 * Every field arrives as a string, including the numeric codes, so each is
 * coerced explicitly rather than trusted. Unknown keys are preserved by the
 * caller into `access_events.raw` — this schema extracts, it does not gatekeep
 * the payload's shape beyond what we read.
 */
export const accessWebhookEventSchema = z.object({
  EmpId: z.string().min(1),
  AttTime: z.string().min(1),
  DeviceID: z.string().min(1),
  CheckingStatus: z.string().optional(),
  VerifyType: z.string().optional(),
  Event: z.string().optional(),
})

export type AccessWebhookEvent = z.infer<typeof accessWebhookEventSchema>

/**
 * The webhook body: an array of events.
 *
 * The terminal batches, so a single delivery can carry many scans.
 */
export const accessWebhookPayloadSchema = z.array(accessWebhookEventSchema)

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
