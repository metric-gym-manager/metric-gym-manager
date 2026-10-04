/**
 * What a member owes per period: the plan amount, less the linked discount
 * only when that discount recurs.
 *
 * The single formula for every place that states an amount owed — the
 * renewals list the desk collects against, the revenue billing schedule and
 * the reminder SMS. A one-off discount applied to an earlier payment must not
 * reduce what is owed next period. Whether the discount row is still active
 * does not matter: the desk has always charged a recurring discount for as
 * long as the member is linked to it.
 *
 * @param member - The amount fields of a member
 * @returns The amount owed per period, rounded to cents
 * @example
 * effectivePlanAmount({ planAmount: 4000, recurringDiscount: true, discountPercentage: 10 }) // 3600
 */
export function effectivePlanAmount(member: {
  planAmount: number
  recurringDiscount: boolean
  /** The linked discount's percentage, or null when there is no discount. */
  discountPercentage: number | null
}): number {
  const pct = member.recurringDiscount ? (member.discountPercentage ?? 0) : 0
  // Rounded to cents: 3333 * 0.67 is 2233.1099999999997 in IEEE-754, and money
  // that drifts by a fraction of a cent per member fails to reconcile across a
  // few hundred of them.
  return Math.round(member.planAmount * (1 - pct / 100) * 100) / 100
}
