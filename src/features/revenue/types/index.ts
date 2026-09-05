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
   * Cash received in this period from **plan payments only**.
   *
   * Day passes are excluded so the collection rate compares like with like: a
   * day pass is one-off revenue that no membership schedule predicts, and
   * including it can push the ratio past 100%.
   */
  collectedRevenue: number

  /**
   * Cash received in this period that no schedule predicts — currently day
   * passes.
   *
   * **Known gap:** the gym-level admission fee is folded into the first
   * payment's `amount_paid` and is not recorded separately, so it cannot be
   * split out here. 8 first payments exceed the plan amount for this reason.
   * Separating it needs a schema change, tracked rather than guessed at.
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
