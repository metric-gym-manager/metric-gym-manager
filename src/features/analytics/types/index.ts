// ============================================================
// MEMBER ANALYTICS TYPES
// ============================================================

import type {
  ANALYTICS_RANGES,
  ANALYTICS_METRICS,
} from '../config/AnalyticsConfig'

/** Stock-chart style time window (see AnalyticsConfig.ANALYTICS_RANGES). */
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number]

/** Metric plotted on the primary time-series. */
export type AnalyticsMetric = (typeof ANALYTICS_METRICS)[number]

/** Bucket resolution of a time-series. */
export type Granularity = 'day' | 'month' | 'year'

// ── Aggregation inputs (plain, framework-free rows) ──────────────────────────

/** A member row reduced to the fields analytics needs (dates are YYYY-MM-DD). */
export interface MemberRecord {
  id: string
  status: string
  registeredDate: string
  nextDueDate: string
}

/** A payment reduced to its coverage window (dates are YYYY-MM-DD). */
export interface PaymentRecord {
  memberId: string
  paymentDate: string
  /** `next_due_date_calculated` — the date this payment covers the member until. */
  coversUntil: string
}

// ── Output shapes ────────────────────────────────────────────────────────────

/** One point on a time-series. `bucket` is a stable key, `label` is display text. */
export interface TimeSeriesPoint {
  bucket: string
  label: string
  value: number | null
}

/** Month-by-month registrations, this year vs. the year before. */
export interface YoyRegistrationPoint {
  month: number
  label: string
  current: number
  previous: number
}

/** One sign-up cohort's retention over subsequent months. */
export interface CohortRetentionRow {
  cohort: string
  label: string
  cohortSize: number
  /** retention[k] = % of the cohort still active k months after sign-up (null = future). */
  retention: (number | null)[]
}

/** One column of the at-risk / due-soon breakdown. */
export interface AtRiskBucket {
  label: string
  count: number
}

/** Headline KPI tiles. Rate fields are 0–100 or null (not enough data). */
export interface AnalyticsSummary {
  activeMembers: number
  totalMembers: number
  newThisMonth: number
  newSameMonthLastYear: number
  /** YoY % change of this-month sign-ups vs. same month last year (null if base 0). */
  yoyDeltaPct: number | null
  renewalRate: number | null
  churnRate: number | null
  retentionRate: number | null
  atRiskCount: number
}

/** Full analytics payload for one range/year selection. */
export interface MemberAnalyticsResponse {
  range: AnalyticsRange
  year: number
  granularity: Granularity
  generatedAt: string
  summary: AnalyticsSummary
  series: {
    registrations: TimeSeriesPoint[]
    activeMembers: TimeSeriesPoint[]
    renewalRate: TimeSeriesPoint[]
    churnRate: TimeSeriesPoint[]
    retentionRate: TimeSeriesPoint[]
  }
  registrationsYoy: YoyRegistrationPoint[]
  cohortRetention: CohortRetentionRow[]
  atRisk: AtRiskBucket[]
}
