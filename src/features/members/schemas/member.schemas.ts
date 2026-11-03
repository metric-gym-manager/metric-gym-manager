import { z } from 'zod'
import {
  normalizePhoneNumber,
  isValidSriLankanPhone,
} from '@/utils/phone/phone'
import { MemberStatus } from '@/features/members/config/StatusConfig'

// ============================================================
// MEMBER ENUMS
// ============================================================

export const MemberPlanType = z.enum([
  'daily',
  'weekly',
  'monthly',
  '3-months',
  '6-months',
  'annual',
])
export type MemberPlanType = z.infer<typeof MemberPlanType>

// ============================================================
// PHONE NUMBER VALIDATION SCHEMAS
// ============================================================

// Accepts local format (0771234567) or international format (+94771234567)
// Transforms to +94XXXXXXXXX format
const phoneNumberSchema = z
  .string()
  .min(1, 'Phone number is required')
  .refine(
    (val) => isValidSriLankanPhone(val),
    'Invalid Sri Lankan phone number. Use format: 0771234567'
  )
  .transform((val) => `+${normalizePhoneNumber(val)}`)

const optionalPhoneNumberSchema = z
  .string()
  .optional()
  .refine(
    (val) => !val || val.trim() === '' || isValidSriLankanPhone(val),
    'Invalid Sri Lankan phone number. Use format: 0771234567'
  )
  .transform((val) => {
    if (!val || val.trim() === '') return undefined
    return `+${normalizePhoneNumber(val)}`
  })

// ============================================================
// ADD MEMBER SCHEMA
// ============================================================

export const addMemberSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),

  phoneNumber: phoneNumberSchema,

  planType: MemberPlanType,

  planAmount: z
    .number()
    .positive('Plan amount must be greater than 0')
    .max(1000000, 'Plan amount is too large'),

  discountId: z.string().uuid().nullable().optional(),

  recurringDiscount: z.boolean().optional(),

  membershipStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),

  paymentAmount: z
    .number()
    .positive('Payment amount must be greater than 0')
    .max(1000000, 'Payment amount is too large'),

  /**
   * Whether this registration is charged the gym's admission fee.
   *
   * A boolean, not an amount: the fee itself is resolved server-side from the
   * gym row, the same way the public QR flow does it. The client used to
   * compute `paymentAmount = discounted + fee` and send only the total, so the
   * fee was whatever the browser said it was.
   */
  // `.optional()` without `.default()`: a zod default makes the schema's input
  // and output types diverge, which react-hook-form's resolver rejects. The
  // route treats `undefined` as false.
  applyAdmissionFee: z.boolean().optional(),

  // Free-text note (manual desk registration only)
  remarks: z
    .string()
    .max(500, 'Remarks must not exceed 500 characters')
    .optional(),

  // Registration consents — both must be ticked to register
  acceptedTerms: z.boolean().refine((v) => v === true, {
    message: 'You must accept the privacy policy and terms of service',
  }),
  acceptedGymRules: z.boolean().refine((v) => v === true, {
    message: "You must agree to the gym's guidelines and rules",
  }),
})

export type AddMemberInput = z.infer<typeof addMemberSchema>

/** The most members one bulk registration may carry (grid and route agree). */
export const BULK_REGISTER_MAX_ROWS = 50

/** POST /api/members/bulk — a batch of rows from the bulk-entry grid. */
export const bulkRegisterSchema = z.object({
  members: z.array(addMemberSchema).min(1).max(BULK_REGISTER_MAX_ROWS),
})

// ============================================================
// UPDATE MEMBER SCHEMA
// ============================================================

export const updateMemberSchema = z.object({
  // Trimmed BEFORE the length check: the entity trims a name and refuses one
  // under two characters afterwards, so " a" used to pass here and fail there as
  // a plain Error (a 500) instead of a validation message.
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .optional(),

  phoneNumber: optionalPhoneNumberSchema,

  planType: MemberPlanType.optional(),

  // `invalid_type_error` because a cleared number input is NaN (react-hook-form
  // `valueAsNumber`), which zod would otherwise report as "Expected number,
  // received nan" next to the field.
  planAmount: z
    .number({ invalid_type_error: 'Enter a plan amount' })
    .positive('Plan amount must be greater than 0')
    .max(1000000, 'Plan amount is too large')
    .optional(),

  discountId: z.string().uuid().nullable().optional(),

  recurringDiscount: z.boolean().optional(),
})

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>

// ============================================================
// COLLECT PAYMENT SCHEMA
// ============================================================

export const collectPaymentSchema = z.object({
  memberId: z.string().uuid(),

  planAmount: z
    .number()
    .positive('Plan amount must be greater than 0')
    .max(1000000, 'Plan amount is too large'),

  // Optional plan switch applied during reactivation. When present, the member
  // is moved onto this plan (with `planAmount` as the new recurring price)
  // before the due date is recalculated. Omitted for a regular "mark paid".
  planType: MemberPlanType.optional(),

  discountId: z.string().uuid().nullable().optional(),

  paymentAmount: z
    .number()
    .positive('Payment amount must be greater than 0')
    .max(1000000, 'Payment amount is too large'),

  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),

  deductOverduePeriod: z.boolean().optional(),
})

export type CollectPaymentInput = z.infer<typeof collectPaymentSchema>

// ============================================================
// MEMBER QUERY FILTERS
// ============================================================

export const memberFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.nativeEnum(MemberStatus).optional(),
  planType: MemberPlanType.optional(),
  sortBy: z
    .enum(['newest', 'oldest', 'upcoming_due', 'recently_expired'])
    .optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
})

export type MemberFiltersInput = z.infer<typeof memberFiltersSchema>
