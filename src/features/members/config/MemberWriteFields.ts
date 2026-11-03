/**
 * Which member columns a write may touch.
 *
 * Every write names the fields it changes. There is deliberately no "write the
 * whole member" operation: a writer reads a member, changes one to three
 * columns, and used to write all ~22 back, so any change another request made
 * in between was put back. A payment reverted a profile edit; a nightly cron
 * reverted a payment recorded while it ran.
 *
 * The groups below are the columns each operation owns. Two operations are safe
 * to interleave exactly when their groups do not overlap, which
 * `MemberWriteFields.test.ts` pins for profile edits against payments.
 *
 * Domain field names, not column names; the repository maps them.
 */

/** Every field a member write may name. */
export type MemberWritableField =
  | 'name'
  | 'phoneNumber'
  | 'planType'
  | 'planAmount'
  | 'discountId'
  | 'recurringDiscount'
  | 'status'
  | 'nextDueDate'
  | 'photoPath'
  | 'photoUpdatedAt'
  | 'verifiedAt'

/** What the edit form owns. */
export const PROFILE_FIELDS = [
  'name',
  'phoneNumber',
  'planType',
  'planAmount',
  'discountId',
  'recurringDiscount',
] as const satisfies readonly MemberWritableField[]

/**
 * What a payment, a day pass or a reactivation changes: the status and when the
 * membership is next due. `status` is always listed, even for a renewal that
 * leaves it Active, so the quota, member-count and status-history triggers
 * (`UPDATE OF status`) fire exactly as they did.
 */
export const LIFECYCLE_FIELDS = [
  'status',
  'nextDueDate',
] as const satisfies readonly MemberWritableField[]

/** A status transition that moves nothing else: suspend, cancel, expiry. */
export const STATUS_FIELDS = [
  'status',
] as const satisfies readonly MemberWritableField[]

/** Added to a payment's write only when the payment switches the plan. */
export const PLAN_FIELDS = [
  'planType',
  'planAmount',
] as const satisfies readonly MemberWritableField[]

/** Saving or removing a face photo. */
export const PHOTO_FIELDS = [
  'photoPath',
  'photoUpdatedAt',
] as const satisfies readonly MemberWritableField[]

/** Verifying a QR self-registration. */
export const VERIFICATION_FIELDS = [
  'verifiedAt',
] as const satisfies readonly MemberWritableField[]
