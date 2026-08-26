/**
 * Member Analytics — domain configuration (single source of truth).
 *
 * This feature owns the analytics range/metric vocabulary and the tuning knobs
 * for the payment-derived membership metrics. Nothing else in the app defines a
 * second copy of these (R5 — single ownership). The Zod query schema and the
 * TypeScript unions both derive from the const tuples here.
 *
 * IMPORTANT (honest-metrics note): churn and retention are DERIVED from the
 * immutable `payments` ledger using a coverage/lapse model — the database stores
 * only a member's *current* status, never a "member left on date X" event. A
 * member is treated as covered from a payment date through its calculated next
 * due date; when that coverage ends and no further payment resumes it, the
 * membership is counted as lapsed (churned) for that period. These are estimates
 * surfaced as such in the UI, not recorded facts.
 */

/**
 * Stock-chart style time windows for the primary time-series.
 *  - `1M` / `3M` → trailing days (daily buckets)
 *  - `YTD`       → Jan 1 of the current year → today (monthly buckets)
 *  - `1Y`        → a selected calendar year, this or any past year (monthly)
 *  - `MAX`       → gym creation → today (monthly, or yearly for long spans)
 */
export const ANALYTICS_RANGES = ['1M', '3M', 'YTD', '1Y', 'MAX'] as const

/** Metrics the primary chart can plot. */
export const ANALYTICS_METRICS = [
  'registrations',
  'active',
  'renewalRate',
  'churnRate',
  'retentionRate',
] as const

/**
 * A `MAX` span wider than this many months switches the primary chart from
 * monthly to yearly buckets so the axis stays legible.
 */
export const MAX_RANGE_MONTHLY_LIMIT = 36

/**
 * Members whose next payment falls due within this many days (or are already
 * overdue) count toward the "at-risk" churn early-warning headline.
 */
export const AT_RISK_WINDOW_DAYS = 7

/** Ascending day thresholds for the at-risk breakdown chart. */
export const AT_RISK_BUCKET_DAYS = [3, 7, 14] as const

/** How many recent sign-up cohorts the cohort-retention grid shows. */
export const COHORT_RETENTION_MAX_COHORTS = 12

/** How many months forward each cohort is tracked. */
export const COHORT_RETENTION_MAX_MONTHS = 12

/** Statuses that still represent a billable/at-risk relationship (not gone). */
export const AT_RISK_STATUSES = ['active', 'expired'] as const

export const MONTH_LABELS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const
