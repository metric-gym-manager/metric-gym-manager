/**
 * Billing schedule — when a member is billed, and for how much.
 *
 * ## Why this exists
 *
 * `/revenue` used to present a **run-rate** and label it "projected": every
 * active member's plan normalised to a month (annual ÷ 12, 6-month ÷ 6, daily
 * × 30, weekly × 4.33). That is a valuation of the membership base, not a bill.
 * It was then compared against cash collected in a calendar month and the ratio
 * labelled "% of billed" — a denominator that had never been billed. One gym
 * showed **127.7% of billed**, which a real billing model cannot produce.
 *
 * This module answers the question the page was always pretending to answer:
 * *which members have a due date in this month, and what do they owe?*
 *
 * ## Why it is derived, not looked up
 *
 * There is no dues or invoices table — nothing in the schema records what was
 * *owed*, only what was paid. The two obvious alternatives were both checked
 * against production and rejected:
 *
 * - **`members.next_due_date` alone is wrong**, because it advances on payment.
 *   For September on the largest gym: 87 active members still due, and 49 who
 *   had already paid and so no longer looked due. Filtering on it undercounts
 *   what was billed by 36%.
 * - **Reconstructing from payment history is unreliable**: 31 duplicate payment
 *   rows across 22 members (3.6% of 871), plus 7 future-dated payments. One
 *   member has three identical payments on one day yielding the same next due
 *   date, which makes any chain-walk produce nonsense.
 *
 * The membership itself — start date plus the plan's period — is deterministic,
 * duplicate-proof, and independent of whether anyone has paid yet. So the
 * schedule is computed from it.
 *
 * ## Purity
 *
 * No database, no dates-from-`now()`, no framework. Every function is total and
 * testable, which is the point: this is the one piece of the revenue model that
 * has to be exactly right.
 */

import { PlanType, PLAN_CONFIGS } from '@/features/members/config/PlanConfig'
import { MemberStatus } from '@/features/members/config/StatusConfig'

/**
 * Statuses that owe money.
 *
 * `expired` is billable: it means the payment is overdue, which is precisely
 * why the renewals screen chases those members. `suspended` (on hold) and
 * `cancelled` (paid through, no longer a member) do not owe.
 *
 * This is a business rule. It is stated once, here, so no caller re-derives it.
 */
export const BILLABLE_STATUSES: readonly MemberStatus[] = [
  MemberStatus.Active,
  MemberStatus.Expired,
]

export function isBillable(status: MemberStatus): boolean {
  return BILLABLE_STATUSES.includes(status)
}

/** The minimum a member needs for its billing schedule to be derivable. */
export interface BillableMember {
  planType: PlanType
  planAmount: number
  /** `YYYY-MM-DD`. Parsed as a calendar date, never a timestamp. */
  membershipStartDate: string
  status: MemberStatus
  recurringDiscount: boolean
  /** The linked discount's percentage, or null when there is no discount. */
  discountPercentage: number | null
}

/**
 * What this member is billed per occurrence.
 *
 * A discount reduces the bill only when it recurs; a one-off discount applied
 * to a past payment must not reduce what is owed next period. The old revenue
 * model summed raw `plan_amount` and so over-billed every discounted member.
 *
 * Same formula as the renewals read model (`payment-reports.service.ts`),
 * deliberately — two ways of computing what a member owes is one too many.
 */
export function effectiveAmountFor(member: BillableMember): number {
  const pct = member.recurringDiscount ? (member.discountPercentage ?? 0) : 0
  // Rounded to cents: 3333 * 0.67 is 2233.1099999999997 in IEEE-754, and money
  // that drifts by a fraction of a cent per member is money that fails to
  // reconcile across a few hundred of them.
  return Math.round(member.planAmount * (1 - pct / 100) * 100) / 100
}

/** Parse `YYYY-MM-DD` without letting a timezone shift the calendar day. */
function parseYmd(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split('-').map(Number)
  return { year, month, day }
}

/**
 * A plan's period expressed in whole months, or `null` for day-based plans.
 *
 * Read from `PLAN_CONFIGS` rather than re-listed, so a new plan type cannot
 * disagree with the rest of the app about how long it lasts (R5). The previous
 * implementation hard-coded a `switch` that had **no case for `custom`**, so
 * custom-plan members silently contributed zero revenue.
 */
function periodInMonths(planType: PlanType): number | null {
  const config = PLAN_CONFIGS[planType]
  switch (config.durationMethod) {
    case 'month':
      return config.durationValue
    case 'year':
      return config.durationValue * 12
    case 'day':
      return null
    default: {
      // Exhaustiveness: adding a duration method without handling it here is a
      // compile error, not a plan that quietly bills nothing.
      const unreachable: never = config.durationMethod
      return unreachable
    }
  }
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * How many times this member is billed within the given calendar month.
 *
 * Month-based plans return 0 or 1. Day-based plans (daily, weekly) genuinely
 * recur many times inside a month and are **counted**, not approximated — the
 * old model multiplied by fixed factors of 30 and 4.33, which ignored both the
 * length of the month and the day the member joined.
 *
 * The member's start month counts: the registration payment covers the first
 * period, so it is a billing event like any other.
 *
 * @param member - Plan, amount and start date.
 * @param year - Calendar year.
 * @param month - Calendar month, 1-12.
 */
export function dueOccurrencesInMonth(
  member: BillableMember,
  year: number,
  month: number
): number {
  const start = parseYmd(member.membershipStartDate)

  const monthsSinceStart = (year - start.year) * 12 + (month - start.month)

  // Nothing is billed before the membership began.
  if (monthsSinceStart < 0) return 0

  const period = periodInMonths(member.planType)

  if (period !== null) {
    // Reasoned in whole months rather than by adding days, so a member who
    // started on the 31st — whose actual due dates land on the 28th or 30th in
    // shorter months — still bills in the right month.
    return monthsSinceStart % period === 0 ? 1 : 0
  }

  // Day-based: count the recurrence dates that land inside the month.
  const stepDays = PLAN_CONFIGS[member.planType].durationValue
  const lastDay = daysInMonth(year, month)

  const monthStart = Date.UTC(year, month - 1, 1)
  const monthEnd = Date.UTC(year, month - 1, lastDay)
  const startUtc = Date.UTC(start.year, start.month - 1, start.day)

  const dayMs = 24 * 60 * 60 * 1000
  const stepMs = stepDays * dayMs

  // First occurrence on or after the start of the month.
  const elapsed = monthStart - startUtc
  const firstIndex = elapsed <= 0 ? 0 : Math.ceil(elapsed / stepMs)
  const firstOccurrence = startUtc + firstIndex * stepMs

  if (firstOccurrence > monthEnd) return 0

  return Math.floor((monthEnd - firstOccurrence) / stepMs) + 1
}

/**
 * Total billed to a set of members in one calendar month.
 *
 * Non-billable members are skipped, so callers may pass an unfiltered list.
 *
 * @param members - Any members; only {@link BILLABLE_STATUSES} contribute.
 * @param year - Calendar year.
 * @param month - Calendar month, 1-12.
 * @returns Amount billed, rounded to cents.
 */
export function billedInMonth(
  members: readonly BillableMember[],
  year: number,
  month: number
): number {
  const total = members.reduce((sum, member) => {
    if (!isBillable(member.status)) return sum
    const occurrences = dueOccurrencesInMonth(member, year, month)
    if (occurrences === 0) return sum
    return sum + effectiveAmountFor(member) * occurrences
  }, 0)

  return Math.round(total * 100) / 100
}
