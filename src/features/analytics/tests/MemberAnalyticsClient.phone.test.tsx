import { screen, within, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import type { MemberAnalyticsResponse } from '../types'
import MemberAnalyticsClient from '../components/MemberAnalyticsClient'

/**
 * Member Analytics on a phone (mobile rebuild plan §13, §12 C-alt, §25.4, §26).
 *
 * The audit's charge against this screen was that the cohort matrix is
 * **1,093 px wide with 3½ of its 15 columns visible** at 390, so the
 * comparison the matrix exists for is impossible; that the segmented controls
 * are 26 px tall and the series toggle wraps to two rows; and that the charts'
 * axis labels clip. So the assertions here are about reachability — that every
 * one of a cohort's thirteen values can be got to, and that the condensed row
 * still carries the three milestones — rather than about the screen mounting.
 *
 * A separate file from the desktop suite, which this phase does not edit.
 *
 * What it cannot see: whether any of it fits, or whether a row is tappable at
 * 44 px. jsdom computes no geometry; the widths are the probe's.
 */

const chartProps: Record<string, unknown>[] = []
jest.mock('@/components/ui/primitives/Charts', () => ({
  __esModule: true,
  AreaChart: (p: Record<string, unknown>) => {
    chartProps.push({ type: 'area', ...p })
    return <div data-testid="area-chart" />
  },
  LineChart: (p: Record<string, unknown>) => {
    chartProps.push({ type: 'line', ...p })
    return <div data-testid="line-chart" />
  },
  BarChart: (p: Record<string, unknown>) => {
    chartProps.push({ type: 'bar', ...p })
    return <div data-testid="bar-chart" />
  },
}))

const series = (values: number[]) =>
  values.map((v, i) => ({ bucket: `2026-0${i + 1}`, label: `M${i}`, value: v }))

/** A full thirteen-month cohort — M0 through M12, the config's own maximum. */
const FULL_RETENTION = [100, 92, 88, 79, 75, 71, 66, 60, 55, 51, 48, 44, 40]

const payload = (
  over: Partial<MemberAnalyticsResponse> = {}
): MemberAnalyticsResponse => ({
  range: 'YTD',
  year: 2026,
  granularity: 'month',
  generatedAt: '2026-08-30T00:00:00Z',
  summary: {
    activeMembers: 312,
    totalMembers: 400,
    newThisMonth: 18,
    newSameMonthLastYear: 12,
    yoyDeltaPct: 50,
    renewalRate: 82,
    churnRate: 7,
    retentionRate: 93,
    atRiskCount: 23,
  },
  series: {
    registrations: series([1, 2, 3]),
    activeMembers: series([300, 306, 312]),
    renewalRate: series([80, 81, 82]),
    churnRate: series([9, 8, 7]),
    retentionRate: series([91, 92, 93]),
  },
  registrationsYoy: [{ month: 1, label: 'Jan', previous: 4, current: 6 }],
  atRisk: [{ label: 'Overdue', count: 3 }],
  cohortRetention: [
    {
      cohort: '2025-09',
      label: 'Sep 2025',
      cohortSize: 24,
      retention: FULL_RETENTION,
    },
    // A cohort young enough that M3 and M6 have not happened yet — §25.4's
    // "M1 79% · M3 — · M6 —".
    {
      cohort: '2026-08',
      label: 'Aug 2026',
      cohortSize: 12,
      retention: [100, 79],
    },
  ],
  ...over,
})

const renderPhone = (over: Partial<MemberAnalyticsResponse> = {}) => {
  mockFetchRoutes({ '/api/analytics/members': apiOk(payload(over)) })
  return renderScreen(<MemberAnalyticsClient />, { viewport: 'phone' })
}

const row = async (text: string | RegExp) =>
  (await screen.findByText(text)).closest('li')!

afterEach(() => {
  jest.clearAllMocks()
  chartProps.length = 0
})

describe('Analytics on a phone — the cohort matrix', () => {
  it('renders cohorts as list rows, not a 15-column table', async () => {
    renderPhone()
    await row('Sep 2025')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  /** §12 C-alt / §25.4: cohort month, size, and the three milestones. */
  it('shows the cohort, its size and the M1/M3/M6 milestones', async () => {
    renderPhone()
    const r = within(await row('Sep 2025'))
    expect(r.getByText('24')).toBeInTheDocument()
    expect(r.getByText('M1 92% · M3 79% · M6 66%')).toBeInTheDocument()
  })

  /** §25.4: a month the cohort has not reached renders "—", not 0%. */
  it('renders an unreached milestone as a dash', async () => {
    renderPhone()
    expect(
      within(await row('Aug 2026')).getByText('M1 79% · M3 — · M6 —')
    ).toBeInTheDocument()
  })

  /**
   * The phase's whole claim: nothing the desktop matrix holds is removed —
   * every one of the thirteen values is one tap away (§13, C9).
   */
  it('reveals all thirteen M0–M12 values when the row is expanded', async () => {
    renderPhone()
    const r = await row('Sep 2025')

    // Collapsed: the three milestones only.
    expect(within(r).queryByText('M0 100%')).not.toBeInTheDocument()

    fireEvent.click(within(r).getByRole('button', { name: 'Sep 2025' }))

    const shown = FULL_RETENTION.map((_, k) =>
      within(r).queryByText(`M${k} ${FULL_RETENTION[k]}%`) ? k : null
    ).filter((k) => k !== null)
    // Named individually rather than counted, so a failure says WHICH month
    // went missing rather than "expected 13, got 12".
    expect(shown).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('collapses again on a second tap, and expands cohorts independently', async () => {
    renderPhone()
    const first = await row('Sep 2025')
    const second = await row('Aug 2026')

    fireEvent.click(within(first).getByRole('button', { name: 'Sep 2025' }))
    expect(within(first).getByText('M0 100%')).toBeInTheDocument()
    // Opening one row must not open the other.
    expect(within(second).queryByText('M0 100%')).not.toBeInTheDocument()

    fireEvent.click(within(first).getByRole('button', { name: 'Sep 2025' }))
    expect(within(first).queryByText('M0 100%')).not.toBeInTheDocument()
  })

  it('keeps the empty state when there are no cohorts', async () => {
    renderPhone({ cohortRetention: [] })
    expect(await screen.findByText('No cohorts yet.')).toBeInTheDocument()
  })
})

describe('Analytics on a phone — controls', () => {
  /** §13: a native `Select`, driving the same `metric` state variable. */
  it('renders the series control as a select, not a segmented group', async () => {
    renderPhone()
    const select = await screen.findByLabelText('Metric')
    expect(select.tagName).toBe('SELECT')
    expect(
      screen.queryByRole('group', { name: 'Metric' })
    ).not.toBeInTheDocument()
  })

  it('switches the plotted series from the select', async () => {
    renderPhone()
    const select = await screen.findByLabelText('Metric')

    fireEvent.change(select, { target: { value: 'churnRate' } })

    // The TREND chart, found by its label — `.at(-1)` is the at-risk bars,
    // which render last in the tree and say nothing about the series control.
    const trend = chartProps.filter((p) => String(p.label).endsWith('over YTD'))
    expect(trend.at(-1)!.label).toBe('Churn % over YTD')
    expect(trend.at(-1)!.type).toBe('line')
  })

  /** §13/§25.4: the range row scrolls rather than wrapping on a phone. */
  it('marks the range row as the sanctioned horizontal scroller', async () => {
    renderPhone()
    const group = await screen.findByRole('group', { name: 'Time range' })
    expect(group).toHaveAttribute('data-scroll', 'x')
    // `phone:`-scoped, so the desktop box is not turned into a scroll
    // container — F30, which cost the desktop a pixel of tab underline.
    expect(group.className).toContain('phone:overflow-x-auto')
    expect(group.className).not.toMatch(/(^|\s)overflow-x-auto/)
  })

  it('keeps all five ranges reachable', async () => {
    renderPhone()
    const group = await screen.findByRole('group', { name: 'Time range' })
    const labels = within(group)
      .getAllByRole('button')
      .map((b) => b.textContent)
    expect(labels).toEqual(['1M', '3M', 'YTD', '1Y', 'MAX'])
  })
})

describe('Analytics on a phone — chart axes', () => {
  it('asks every chart for a compact axis', async () => {
    renderPhone()
    await screen.findByTestId('area-chart')
    expect(chartProps.length).toBeGreaterThanOrEqual(3)
    for (const p of chartProps) expect(p.compactAxis).toBe(true)
  })

  it('leaves the desktop axes alone', async () => {
    mockFetchRoutes({ '/api/analytics/members': apiOk(payload()) })
    renderScreen(<MemberAnalyticsClient />, { viewport: 'desktop' })
    await screen.findByTestId('area-chart')
    for (const p of chartProps) expect(p.compactAxis).toBe(false)
  })
})
