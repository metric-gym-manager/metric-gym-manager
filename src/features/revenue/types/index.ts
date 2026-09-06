// ============================================================
// REVENUE TYPES
// ============================================================

/**
 * One month of the revenue history.
 *
 * `projectedRevenue` was removed. It was computed per month from **today's**
 * active members, so a member who cancelled was erased from every past month
 * retroactively and the "history" changed whenever anyone left. It was also
 * never rendered — the chart plots `collectedRevenue` only — while costing two
 * database queries per month since the gym was created.
 *
 * A truthful historical *billed* figure is not currently derivable: `members`
 * records only the current `status`, with no `cancelled_at` and no status audit,
 * so who was active in a past month is unknown. Rather than approximate it and
 * present the approximation as history, the series carries what is actually a
 * fact — the cash that arrived.
 */
export interface MonthlyRevenue {
  year: number
  month: number
  monthLabel: string // e.g., "Jan 2024"
  collectedRevenue: number
}

export interface RevenueMetrics {
  totalActiveMembers: number
  totalRevenueSinceInception: number
  averageRevenuePerMember: number
}

/**
 * The current period's billing position.
 *
 * Four separately-named quantities, because the previous shape compared two
 * things that were never comparable: cash collected in a calendar month against
 * a *run-rate* valuation of the whole membership base, labelled "% of billed".
 * One gym rendered **127.7% of billed**, which a real billing model cannot
 * produce.
 */
export interface RevenuePosition {
  /**
   * What billable members owe for this period, from their actual due dates
   * (`features/revenue/domain/BillingSchedule`) — not a normalised run-rate.
   */
  billedRevenue: number

  /**
   * **All cash received in this period.** Plan payments, the admission fees
   * inside them, and day passes.
   *
   * This is the figure a gym reports as revenue, so it must never be a subset.
   * It is deliberately the total and not the plan-only figure: an earlier
   * revision made this exclude admission fees and day passes for the sake of a
   * clean collection rate, which would have caused the revenue page to
   * under-report against the dashboard as soon as a gym charged a joining fee.
   *
   * Equals `planCollectedRevenue + oneOffRevenue`, and equals the dashboard's
   * `revenueThisMonth` (`SUM(amount_paid)`) for the same month.
   */
  collectedRevenue: number

  /**
   * The part of `collectedRevenue` a membership schedule predicts — plan
   * payments excluding any admission fee inside them.
   *
   * Exists purely so the collection rate has a numerator comparable with
   * `billedRevenue`. Do not present it as revenue.
   */
  planCollectedRevenue: number

  /**
   * The part of `collectedRevenue` no schedule predicts: admission fees and day
   * passes. Reported separately so the collection rate is not inflated past
   * 100% by one-off cash — which is exactly what used to happen.
   *
   * **Known gap:** admission fees on payments written before 2026-09-05 were
   * not recorded separately and are still counted as plan revenue.
   */
  oneOffRevenue: number

  /** Billable members whose due date has already passed. */
  overdueMemberCount: number
}

// ============================================================
// RESPONSE TYPES
// ============================================================

export interface MonthlyRevenueResponse {
  currentMonth: RevenuePosition
  historicalData: MonthlyRevenue[]
  metrics: RevenueMetrics
}
