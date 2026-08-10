/**
 * Access Decision — the sole authority on whether a member may open a door.
 *
 * Pure: no I/O, no framework imports, no clock access. Everything that talks to
 * hardware transports this function's output; nothing else decides.
 *
 * ## Why the date, not the status
 *
 * Expiry is derived from `nextDueDate`, NOT from `members.status`. The daily
 * `update-expired-status` cron flips Active → Expired at 00:00 UTC (05:30 in
 * Sri Lanka), but the terminal refuses the member from local midnight. Between
 * those two moments the status column still reads Active while the door is
 * already closed.
 *
 * Deciding from the date closes that gap: staff see "expired" in the app at the
 * same instant the gate starts refusing, and the cron becomes bookkeeping
 * (quota counts, the cancellation chain) rather than the thing gating a door.
 *
 * ## Strictest-of-both
 *
 * A member is admitted only if the status *and* the dates both permit it. Where
 * the two disagree the stricter wins, so every inconsistency fails toward
 * refusing access rather than granting it.
 */

import { MemberStatus } from '@/features/members/config/StatusConfig'
import { RegistrationSource } from '@/features/members/config/RegistrationConfig'
import { AccessDenialReason } from '@/features/access-control/config/AccessControlConfig'
import { toCalendarDay } from '@/features/access-control/utils/getGymToday'

/**
 * Everything the decision depends on. Deliberately primitive-only: this
 * function must be trivially testable without constructing a Member entity.
 */
export interface AccessDecisionInput {
  /** Current membership status. */
  status: MemberStatus

  /** When the billing period begins. Access does not start before this. */
  membershipStartDate: Date

  /** Paid-through date. The member is admitted for the whole of this day. */
  nextDueDate: Date

  /** Desk registration or QR self-registration. */
  registrationSource: RegistrationSource

  /** When the desk verified a QR self-registration. `null` = unverified. */
  verifiedAt: Date | null

  /**
   * The gym's local calendar day.
   *
   * Passed in rather than derived, so the verdict can never become dependent on
   * the server's timezone. Callers use `getGymToday()`.
   */
  today: Date
}

/**
 * The resolved verdict. `validFrom`/`validTo` are the window to push to the
 * terminal; they are populated only when access is allowed.
 */
export interface AccessDecision {
  /** Whether the member may currently open the door. */
  allowed: boolean

  /** Start of the validity window to push. `null` when blocked. */
  validFrom: Date | null

  /**
   * End of the validity window to push, INCLUSIVE.
   *
   * A member with `validTo` = the 15th is admitted through 15th 23:59:59 local
   * and refused from the 16th at 00:00, enforced by the terminal's own clock.
   */
  validTo: Date | null

  /** Why access is denied. `null` when allowed. */
  reason: AccessDenialReason | null

  /**
   * Whether the member's record should be removed from the hardware entirely,
   * rather than merely blocked. True only for cancelled memberships.
   */
  removeFromDevice: boolean
}

/**
 * Resolve whether a member may open the door, and the window to push.
 *
 * @param input - Member state plus the gym's local calendar day.
 * @returns The verdict, and the validity window when access is granted.
 *
 * @example
 * // Paid through the 15th, evaluated on the 15th: admitted.
 * resolveAccessDecision({ ...member, today: new Date('2026-01-15T00:00:00Z') })
 * // => { allowed: true, validTo: 2026-01-15, reason: null }
 *
 * @example
 * // Same member on the 16th: refused, even if `status` still reads Active
 * // because the daily cron has not run yet.
 * resolveAccessDecision({ ...member, today: new Date('2026-01-16T00:00:00Z') })
 * // => { allowed: false, reason: 'expired' }
 */
export function resolveAccessDecision(
  input: AccessDecisionInput
): AccessDecision {
  const today = toCalendarDay(input.today)
  const startDate = toCalendarDay(input.membershipStartDate)
  const dueDate = toCalendarDay(input.nextDueDate)

  // Cancelled is terminal: the record comes off the hardware rather than
  // lingering as a blocked entry.
  if (input.status === MemberStatus.Cancelled) {
    return denied(AccessDenialReason.Cancelled, { removeFromDevice: true })
  }

  // Suspension must bite immediately and must not wait for any date to pass.
  if (input.status === MemberStatus.Suspended) {
    return denied(AccessDenialReason.Suspended)
  }

  // A QR self-registration is an unverified stranger until the desk confirms
  // them. Checked before the dates: an unverified person with a valid-looking
  // payment must still not get through a door.
  if (
    input.registrationSource === RegistrationSource.Qr &&
    input.verifiedAt === null
  ) {
    return denied(AccessDenialReason.Unverified)
  }

  // Deferred or backdated starts: no access before the period begins.
  if (today < startDate) {
    return denied(AccessDenialReason.NotStarted)
  }

  // The core rule. Inclusive of the due date — a member due today is paid
  // through today. No grace period (StatusConfig is the authority on that).
  if (today > dueDate) {
    return denied(AccessDenialReason.Expired)
  }

  // Dates permit access; the status must independently agree. Anything that is
  // not Active at this point (only Expired remains) is refused, so a stale or
  // inconsistent record never opens a door.
  if (input.status !== MemberStatus.Active) {
    return denied(AccessDenialReason.Expired)
  }

  return {
    allowed: true,
    validFrom: startDate,
    validTo: dueDate,
    reason: null,
    removeFromDevice: false,
  }
}

/**
 * Build a denial verdict.
 *
 * Denials never carry a validity window: pushing one alongside a block would
 * hand the terminal contradictory instructions.
 */
function denied(
  reason: AccessDenialReason,
  options: { removeFromDevice?: boolean } = {}
): AccessDecision {
  return {
    allowed: false,
    validFrom: null,
    validTo: null,
    reason,
    removeFromDevice: options.removeFromDevice ?? false,
  }
}

/**
 * Human-readable explanation for staff.
 *
 * The terminal never tells us why it refused someone — it just doesn't open.
 * This is our own record's explanation, which is why the front desk can answer
 * "why won't it let me in?" when the member asks.
 *
 * @param reason - The denial reason, or `null` for an allowed decision.
 * @returns A sentence safe to show a gym manager (no technical detail).
 */
export function describeAccessDenial(
  reason: AccessDenialReason | null
): string {
  switch (reason) {
    case AccessDenialReason.Expired:
      return 'Membership payment is overdue'
    case AccessDenialReason.Suspended:
      return 'Membership is suspended'
    case AccessDenialReason.Cancelled:
      return 'Membership has been cancelled'
    case AccessDenialReason.Unverified:
      return 'Self-registration is awaiting front-desk verification'
    case AccessDenialReason.NotStarted:
      return 'Membership has not started yet'
    case null:
      return 'Access allowed'
  }
}
