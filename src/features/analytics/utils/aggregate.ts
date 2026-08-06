/**
 * Pure member-analytics aggregation.
 *
 * Everything here is a pure function over plain rows (`MemberRecord[]` +
 * `PaymentRecord[]`) so it is fully unit-testable without a database. The
 * service layer fetches the two row sets once and calls `computeMemberAnalytics`.
 *
 * Churn/retention are DERIVED from the immutable payments ledger via a
 * coverage/lapse model (see AnalyticsConfig for the rationale): each payment
 * covers `[paymentDate, coversUntil]`; a member is "active on date D" when D
 * falls inside a coverage interval; a membership "lapsed" (churned) in a period
 * when its final coverage ended in that period and no later payment resumed it.
 */

import {
  AT_RISK_BUCKET_DAYS,
  AT_RISK_STATUSES,
  AT_RISK_WINDOW_DAYS,
  COHORT_RETENTION_MAX_COHORTS,
  COHORT_RETENTION_MAX_MONTHS,
  MONTH_LABELS_SHORT,
} from '../config/AnalyticsConfig'
import type {
  AnalyticsRange,
  AnalyticsSummary,
  AtRiskBucket,
  CohortRetentionRow,
  Granularity,
  MemberAnalyticsResponse,
  MemberRecord,
  PaymentRecord,
  TimeSeriesPoint,
  YoyRegistrationPoint,
} from '../types'
import {
  addDays,
  addMonths,
  bucketKey,
  bucketLabel,
  bucketPeriod,
  endOfMonth,
  enumerateBuckets,
  minDate,
  resolveAnalyticsWindow,
  toDateKey,
} from './dateBuckets'

// ── Coverage model ───────────────────────────────────────────────────────────

interface CoverageInterval {
  start: string
  end: string
}

export interface MemberCoverage {
  id: string
  status: string
  registeredDate: string
  nextDueDate: string
  /** Coverage intervals in payment order (ascending by payment date). */
  intervals: CoverageInterval[]
  /** Furthest date any payment covers this member until (null = no payments). */
  lastCoversUntil: string | null
}

/** Build per-member coverage from the payments ledger. */
export function buildCoverage(
  members: MemberRecord[],
  payments: PaymentRecord[]
): MemberCoverage[] {
  const byMember = new Map<string, CoverageInterval[]>()
  for (const p of payments) {
    const list = byMember.get(p.memberId) ?? []
    list.push({
      start: toDateKey(p.paymentDate),
      end: toDateKey(p.coversUntil),
    })
    byMember.set(p.memberId, list)
  }

  return members.map((m) => {
    const intervals = (byMember.get(m.id) ?? []).sort((a, b) =>
      a.start < b.start ? -1 : a.start > b.start ? 1 : 0
    )
    const lastCoversUntil = intervals.reduce<string | null>(
      (max, iv) => (max === null || iv.end > max ? iv.end : max),
      null
    )
    return {
      id: m.id,
      status: m.status,
      registeredDate: toDateKey(m.registeredDate),
      nextDueDate: toDateKey(m.nextDueDate),
      intervals,
      lastCoversUntil,
    }
  })
}

/** Is a member covered (active) on a specific date? */
export function activeOnDate(cov: MemberCoverage, dateIso: string): boolean {
  const date = toDateKey(dateIso)
  if (date < cov.registeredDate) return false
  return cov.intervals.some((iv) => iv.start <= date && date <= iv.end)
}

/** Is a member covered at any point during a calendar month (YYYY-MM)? */
function activeInMonth(cov: MemberCoverage, monthKey: string): boolean {
  const monthStart = `${monthKey}-01`
  const monthEnd = endOfMonth(monthStart)
  if (cov.registeredDate > monthEnd) return false
  return cov.intervals.some(
    (iv) => iv.start <= monthEnd && iv.end >= monthStart
  )
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// ── Registrations ────────────────────────────────────────────────────────────

/** Tally registrations by bucket key across every member. */
function registrationCounts(
  members: MemberRecord[],
  granularity: Granularity
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const m of members) {
    const key = bucketKey(m.registeredDate, granularity)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

function registrationsSeries(
  members: MemberRecord[],
  buckets: string[],
  granularity: Granularity
): TimeSeriesPoint[] {
  const counts = registrationCounts(members, granularity)
  return buckets.map((bucket) => ({
    bucket,
    label: bucketLabel(bucket, granularity),
    value: counts.get(bucket) ?? 0,
  }))
}

// ── Active members ───────────────────────────────────────────────────────────

function activeCountOnDate(
  coverage: MemberCoverage[],
  dateIso: string
): number {
  return coverage.reduce((n, c) => (activeOnDate(c, dateIso) ? n + 1 : n), 0)
}

function activeSeries(
  coverage: MemberCoverage[],
  buckets: string[],
  granularity: Granularity,
  todayIso: string
): TimeSeriesPoint[] {
  const today = toDateKey(todayIso)
  return buckets.map((bucket) => {
    const { start, end } = bucketPeriod(bucket, granularity)
    const label = bucketLabel(bucket, granularity)
    if (start > today) return { bucket, label, value: null }
    const reference = minDate(end, today)
    return { bucket, label, value: activeCountOnDate(coverage, reference) }
  })
}

// ── Renewal / churn / retention ──────────────────────────────────────────────

interface PeriodRates {
  renewalRate: number | null
  churnRate: number | null
  retentionRate: number | null
}

/** Renewal, churn and retention over an inclusive [start, end] period. */
export function ratesForPeriod(
  coverage: MemberCoverage[],
  start: string,
  end: string,
  todayIso: string
): PeriodRates {
  const today = toDateKey(todayIso)
  const s = toDateKey(start)
  const e = minDate(end, today)

  // Nothing has happened yet in a fully-future period.
  if (s > today) {
    return { renewalRate: null, churnRate: null, retentionRate: null }
  }

  // Renewal: pair consecutive payments. Each due event (a payment's coversUntil)
  // that fell in the period and has come due was "renewed" iff a later payment
  // exists for that member.
  let dueEvents = 0
  let renewed = 0
  for (const c of coverage) {
    for (let i = 0; i < c.intervals.length; i++) {
      const due = c.intervals[i].end
      if (due >= s && due <= e) {
        dueEvents += 1
        if (i < c.intervals.length - 1) renewed += 1
      }
    }
  }
  const renewalRate = dueEvents > 0 ? round1((renewed / dueEvents) * 100) : null

  // Churn: members whose FINAL coverage ended in the period (and hasn't resumed
  // as of today), over the members active the day before the period began.
  const activeAtStart = activeCountOnDate(coverage, addDays(s, -1))
  const churned = coverage.reduce((n, c) => {
    const last = c.lastCoversUntil
    return last !== null && last >= s && last <= e ? n + 1 : n
  }, 0)
  const churnRate =
    activeAtStart > 0 ? round1((churned / activeAtStart) * 100) : null
  const retentionRate = churnRate === null ? null : round1(100 - churnRate)

  return { renewalRate, churnRate, retentionRate }
}

function rateSeries(
  coverage: MemberCoverage[],
  buckets: string[],
  granularity: Granularity,
  todayIso: string
): {
  renewal: TimeSeriesPoint[]
  churn: TimeSeriesPoint[]
  retention: TimeSeriesPoint[]
} {
  const renewal: TimeSeriesPoint[] = []
  const churn: TimeSeriesPoint[] = []
  const retention: TimeSeriesPoint[] = []
  for (const bucket of buckets) {
    const { start, end } = bucketPeriod(bucket, granularity)
    const label = bucketLabel(bucket, granularity)
    const r = ratesForPeriod(coverage, start, end, todayIso)
    renewal.push({ bucket, label, value: r.renewalRate })
    churn.push({ bucket, label, value: r.churnRate })
    retention.push({ bucket, label, value: r.retentionRate })
  }
  return { renewal, churn, retention }
}

// ── Year-over-year registrations ─────────────────────────────────────────────

export function registrationsYoy(
  members: MemberRecord[],
  year: number
): YoyRegistrationPoint[] {
  const byMonth = registrationCounts(members, 'month')
  const pad = (m: number) => String(m).padStart(2, '0')
  return MONTH_LABELS_SHORT.map((label, i) => {
    const month = i + 1
    return {
      month,
      label,
      current: byMonth.get(`${year}-${pad(month)}`) ?? 0,
      previous: byMonth.get(`${year - 1}-${pad(month)}`) ?? 0,
    }
  })
}

// ── Cohort retention ─────────────────────────────────────────────────────────

export function cohortRetention(
  members: MemberRecord[],
  coverage: MemberCoverage[],
  todayIso: string
): CohortRetentionRow[] {
  const currentMonth = bucketKey(todayIso, 'month')
  const covById = new Map(coverage.map((c) => [c.id, c]))

  // Group members into sign-up-month cohorts (only months already begun).
  const cohorts = new Map<string, MemberRecord[]>()
  for (const m of members) {
    const key = bucketKey(m.registeredDate, 'month')
    if (key > currentMonth) continue
    const list = cohorts.get(key) ?? []
    list.push(m)
    cohorts.set(key, list)
  }

  const keys = Array.from(cohorts.keys())
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)) // newest first
    .slice(0, COHORT_RETENTION_MAX_COHORTS)

  return keys.map((cohort) => {
    const cohortMembers = cohorts.get(cohort) ?? []
    const cohortSize = cohortMembers.length
    const cohortStart = `${cohort}-01`
    const retention: (number | null)[] = []
    for (let k = 0; k <= COHORT_RETENTION_MAX_MONTHS; k++) {
      const monthKey = bucketKey(addMonths(cohortStart, k), 'month')
      if (monthKey > currentMonth) {
        retention.push(null)
        continue
      }
      if (cohortSize === 0) {
        retention.push(null)
        continue
      }
      const stillActive = cohortMembers.reduce((n, m) => {
        const c = covById.get(m.id)
        return c && activeInMonth(c, monthKey) ? n + 1 : n
      }, 0)
      retention.push(round1((stillActive / cohortSize) * 100))
    }
    const [y, mo] = cohort.split('-')
    return {
      cohort,
      label: `${MONTH_LABELS_SHORT[Number(mo) - 1]} ${y}`,
      cohortSize,
      retention,
    }
  })
}

// ── At-risk / due-soon ───────────────────────────────────────────────────────

export function atRiskBreakdown(
  members: MemberRecord[],
  todayIso: string
): AtRiskBucket[] {
  const today = toDateKey(todayIso)
  const atRiskStatuses = new Set<string>(AT_RISK_STATUSES)
  const [d1, d2, d3] = AT_RISK_BUCKET_DAYS
  const buckets: AtRiskBucket[] = [
    { label: 'Overdue', count: 0 },
    { label: `Due ≤${d1}d`, count: 0 },
    { label: `Due ≤${d2}d`, count: 0 },
    { label: `Due ≤${d3}d`, count: 0 },
  ]
  for (const m of members) {
    if (!atRiskStatuses.has(m.status)) continue
    const due = toDateKey(m.nextDueDate)
    if (due < today) buckets[0].count += 1
    else if (due <= addDays(today, d1)) buckets[1].count += 1
    else if (due <= addDays(today, d2)) buckets[2].count += 1
    else if (due <= addDays(today, d3)) buckets[3].count += 1
  }
  return buckets
}

function atRiskCount(members: MemberRecord[], todayIso: string): number {
  const today = toDateKey(todayIso)
  const horizon = addDays(today, AT_RISK_WINDOW_DAYS)
  const atRiskStatuses = new Set<string>(AT_RISK_STATUSES)
  return members.reduce((n, m) => {
    if (!atRiskStatuses.has(m.status)) return n
    return toDateKey(m.nextDueDate) <= horizon ? n + 1 : n
  }, 0)
}

// ── Summary ──────────────────────────────────────────────────────────────────

function buildSummary(
  members: MemberRecord[],
  coverage: MemberCoverage[],
  window: { startIso: string; endIso: string },
  todayIso: string
): AnalyticsSummary {
  const byMonth = registrationCounts(members, 'month')
  const thisMonth = bucketKey(todayIso, 'month')
  const [y, mo] = thisMonth.split('-')
  const lastYearSameMonth = `${Number(y) - 1}-${mo}`

  const newThisMonth = byMonth.get(thisMonth) ?? 0
  const newSameMonthLastYear = byMonth.get(lastYearSameMonth) ?? 0
  const yoyDeltaPct =
    newSameMonthLastYear > 0
      ? round1(
          ((newThisMonth - newSameMonthLastYear) / newSameMonthLastYear) * 100
        )
      : null

  const rates = ratesForPeriod(
    coverage,
    window.startIso,
    window.endIso,
    todayIso
  )

  return {
    activeMembers: members.filter((m) => m.status === 'active').length,
    totalMembers: members.length,
    newThisMonth,
    newSameMonthLastYear,
    yoyDeltaPct,
    renewalRate: rates.renewalRate,
    churnRate: rates.churnRate,
    retentionRate: rates.retentionRate,
    atRiskCount: atRiskCount(members, todayIso),
  }
}

// ── Top-level ────────────────────────────────────────────────────────────────

export interface ComputeOptions {
  range: AnalyticsRange
  year: number
  /** Today as YYYY-MM-DD (injected for determinism/testing). */
  todayIso: string
  /** Gym creation date/timestamp (bounds the MAX range). */
  gymCreatedIso: string
}

/** Compute the full analytics payload for one range/year selection. */
export function computeMemberAnalytics(
  members: MemberRecord[],
  payments: PaymentRecord[],
  options: ComputeOptions
): MemberAnalyticsResponse {
  const { range, year, todayIso, gymCreatedIso } = options
  const window = resolveAnalyticsWindow(range, year, todayIso, gymCreatedIso)
  const { startIso, endIso, granularity } = window
  const coverage = buildCoverage(members, payments)
  const buckets = enumerateBuckets(startIso, endIso, granularity)

  const rates = rateSeries(coverage, buckets, granularity, todayIso)

  return {
    range,
    year,
    granularity,
    generatedAt: new Date().toISOString(),
    summary: buildSummary(members, coverage, window, todayIso),
    series: {
      registrations: registrationsSeries(members, buckets, granularity),
      activeMembers: activeSeries(coverage, buckets, granularity, todayIso),
      renewalRate: rates.renewal,
      churnRate: rates.churn,
      retentionRate: rates.retention,
    },
    registrationsYoy: registrationsYoy(members, year),
    cohortRetention: cohortRetention(members, coverage, todayIso),
    atRisk: atRiskBreakdown(members, todayIso),
  }
}
