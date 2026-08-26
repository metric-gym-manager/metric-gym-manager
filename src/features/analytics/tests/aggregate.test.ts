import {
  atRiskBreakdown,
  buildCoverage,
  activeOnDate,
  cohortRetention,
  computeMemberAnalytics,
  ratesForPeriod,
  registrationsYoy,
} from '../utils/aggregate'
import type { MemberRecord, PaymentRecord } from '../types'

const TODAY = '2026-08-06'
const GYM = '2025-01-01'

function m(
  id: string,
  registeredDate: string,
  status = 'active',
  nextDueDate = '2026-09-01'
): MemberRecord {
  return { id, status, registeredDate, nextDueDate }
}
function p(
  memberId: string,
  paymentDate: string,
  coversUntil: string
): PaymentRecord {
  return { memberId, paymentDate, coversUntil }
}

// A renews every month through Aug; B pays once and lapses at the June boundary.
const MEMBERS = [
  m('A', '2026-05-01', 'active', '2026-08-01'),
  m('B', '2026-05-01', 'expired', '2026-06-01'),
]
const PAYMENTS = [
  p('A', '2026-05-01', '2026-06-01'),
  p('A', '2026-06-01', '2026-07-01'),
  p('A', '2026-07-01', '2026-08-01'),
  p('B', '2026-05-01', '2026-06-01'),
]

describe('coverage model', () => {
  const coverage = buildCoverage(MEMBERS, PAYMENTS)
  const A = coverage.find((c) => c.id === 'A')!
  const B = coverage.find((c) => c.id === 'B')!

  it('sorts intervals and records the furthest coverage end', () => {
    expect(A.intervals).toHaveLength(3)
    expect(A.lastCoversUntil).toBe('2026-08-01')
    expect(B.lastCoversUntil).toBe('2026-06-01')
  })

  it('reports active status on a given date from coverage', () => {
    expect(activeOnDate(A, '2026-06-15')).toBe(true)
    expect(activeOnDate(A, '2026-08-15')).toBe(false)
    expect(activeOnDate(B, '2026-06-15')).toBe(false)
    expect(activeOnDate(A, '2026-04-15')).toBe(false) // before registration
  })
})

describe('ratesForPeriod (renewal / churn / retention)', () => {
  const coverage = buildCoverage(MEMBERS, PAYMENTS)

  it('computes June: one renewal, one lapse against two active', () => {
    expect(ratesForPeriod(coverage, '2026-06-01', '2026-06-30', TODAY)).toEqual(
      {
        renewalRate: 50,
        churnRate: 50,
        retentionRate: 50,
      }
    )
  })

  it('computes July: full renewal, no churn', () => {
    expect(ratesForPeriod(coverage, '2026-07-01', '2026-07-31', TODAY)).toEqual(
      {
        renewalRate: 100,
        churnRate: 0,
        retentionRate: 100,
      }
    )
  })

  it('returns nulls for a future period', () => {
    expect(ratesForPeriod(coverage, '2026-12-01', '2026-12-31', TODAY)).toEqual(
      {
        renewalRate: null,
        churnRate: null,
        retentionRate: null,
      }
    )
  })

  it('guards divide-by-zero when nothing was due / nobody was active', () => {
    const solo = buildCoverage(
      [m('S', '2026-08-01', 'active', '2026-09-01')],
      []
    )
    expect(ratesForPeriod(solo, '2026-08-01', '2026-08-31', TODAY)).toEqual({
      renewalRate: null,
      churnRate: null,
      retentionRate: null,
    })
  })
})

describe('registrationsYoy', () => {
  const members = [
    m('r1', '2025-08-15'),
    m('r2', '2026-08-03'),
    m('r3', '2026-08-20'),
    m('r4', '2026-07-10'),
  ]
  const yoy = registrationsYoy(members, 2026)

  it('has one entry per month', () => {
    expect(yoy).toHaveLength(12)
  })

  it('compares each month to the same month last year', () => {
    expect(yoy.find((y) => y.month === 8)).toEqual({
      month: 8,
      label: 'Aug',
      current: 2,
      previous: 1,
    })
    expect(yoy.find((y) => y.month === 7)).toEqual({
      month: 7,
      label: 'Jul',
      current: 1,
      previous: 0,
    })
  })
})

describe('atRiskBreakdown', () => {
  const members = [
    m('o', '2026-01-01', 'active', '2026-08-04'), // overdue
    m('a', '2026-01-01', 'active', '2026-08-08'), // <=3d
    m('b', '2026-01-01', 'expired', '2026-08-12'), // <=7d
    m('c', '2026-01-01', 'active', '2026-08-19'), // <=14d
    m('d', '2026-01-01', 'active', '2026-09-30'), // beyond
    m('x', '2026-01-01', 'cancelled', '2026-08-04'), // excluded by status
  ]

  it('buckets active/expired members by days-until-due', () => {
    expect(atRiskBreakdown(members, TODAY)).toEqual([
      { label: 'Overdue', count: 1 },
      { label: 'Due ≤3d', count: 1 },
      { label: 'Due ≤7d', count: 1 },
      { label: 'Due ≤14d', count: 1 },
    ])
  })
})

describe('cohortRetention', () => {
  const coverage = buildCoverage(MEMBERS, PAYMENTS)
  const rows = cohortRetention(MEMBERS, coverage, TODAY)

  it('tracks the May cohort month-over-month', () => {
    const may = rows.find((r) => r.cohort === '2026-05')!
    expect(may.cohortSize).toBe(2)
    expect(may.label).toBe('May 2026')
    // k=0 May, k=1 Jun, k=2 Jul, k=3 Aug (A retained, B lapsed after Jun), k=4 future
    expect(may.retention.slice(0, 5)).toEqual([100, 100, 50, 50, null])
  })
})

describe('computeMemberAnalytics', () => {
  const members = [
    m('A', '2026-05-01', 'active', '2026-08-01'),
    m('B', '2026-05-01', 'expired', '2026-06-01'),
    m('C', '2026-08-02', 'active', '2026-09-02'),
    m('D', '2025-08-10', 'active', '2026-08-10'),
  ]
  const payments = [...PAYMENTS, p('C', '2026-08-02', '2026-09-02')]
  const result = computeMemberAnalytics(members, payments, {
    range: 'YTD',
    year: 2026,
    todayIso: TODAY,
    gymCreatedIso: GYM,
  })

  it('resolves YTD to monthly buckets Jan..Aug', () => {
    expect(result.granularity).toBe('month')
    expect(result.series.registrations).toHaveLength(8)
    const may = result.series.registrations.find(
      (pt) => pt.bucket === '2026-05'
    )
    const aug = result.series.registrations.find(
      (pt) => pt.bucket === '2026-08'
    )
    expect(may?.value).toBe(2)
    expect(aug?.value).toBe(1)
  })

  it('keeps every series aligned to the same buckets', () => {
    const n = result.series.registrations.length
    expect(result.series.activeMembers).toHaveLength(n)
    expect(result.series.renewalRate).toHaveLength(n)
    expect(result.series.churnRate).toHaveLength(n)
    expect(result.series.retentionRate).toHaveLength(n)
  })

  it('summarizes headline KPIs incl. YoY same-month sign-ups', () => {
    expect(result.summary.activeMembers).toBe(3) // A, C, D
    expect(result.summary.totalMembers).toBe(4)
    expect(result.summary.newThisMonth).toBe(1) // C in Aug 2026
    expect(result.summary.newSameMonthLastYear).toBe(1) // D in Aug 2025
    expect(result.summary.yoyDeltaPct).toBe(0)
    expect(result.atRisk).toHaveLength(4)
  })
})

describe('computeMemberAnalytics — empty gym', () => {
  it('produces a zeroed payload without throwing', () => {
    const result = computeMemberAnalytics([], [], {
      range: 'MAX',
      year: 2026,
      todayIso: TODAY,
      gymCreatedIso: '2026-06-01',
    })
    expect(result.summary.activeMembers).toBe(0)
    expect(result.summary.totalMembers).toBe(0)
    expect(result.summary.renewalRate).toBeNull()
    expect(result.summary.churnRate).toBeNull()
    expect(result.summary.atRiskCount).toBe(0)
    expect(result.cohortRetention).toEqual([])
    expect(result.series.registrations.length).toBeGreaterThan(0)
  })
})
