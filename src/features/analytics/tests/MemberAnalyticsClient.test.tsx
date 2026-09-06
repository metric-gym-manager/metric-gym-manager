import { screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import type { MemberAnalyticsResponse } from '../types'
import MemberAnalyticsClient from '../components/MemberAnalyticsClient'

// Recharts needs a measured container; jsdom reports 0×0. The chart series are
// asserted through the props the screen passes, not through rendered SVG.
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

// Typed against the real response, so a schema change breaks this at compile
// time rather than as an undefined `toLocaleString` inside a render.
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
      cohort: '2026-08',
      label: 'Aug 2026',
      cohortSize: 20,
      retention: [100, 90],
    },
  ],
  ...over,
})

describe('MemberAnalyticsClient', () => {
  beforeEach(() => {
    chartProps.length = 0
  })
  afterEach(() => jest.clearAllMocks())

  it('renders the summary readouts', async () => {
    mockFetchRoutes({ '/api/analytics/members': apiOk(payload()) })
    renderScreen(<MemberAnalyticsClient />)

    expect(await screen.findByText('312')).toBeInTheDocument()
    expect(screen.getByText('400 total')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(screen.getByText('vs 12 last year')).toBeInTheDocument()
    expect(screen.getByText('82%')).toBeInTheDocument()
    expect(screen.getByText('7%')).toBeInTheDocument()
    expect(screen.getByText('Retention 93%')).toBeInTheDocument()
  })

  /**
   * A rate is `null` for a gym with no history, and `null` is not `0` — a new
   * gym showing "0% renewal" reads as total failure rather than "no data yet".
   */
  it('renders an absent rate as a dash, not as zero', async () => {
    mockFetchRoutes({
      '/api/analytics/members': apiOk(
        payload({
          summary: {
            ...payload().summary,
            renewalRate: null,
            churnRate: null,
            retentionRate: null,
            yoyDeltaPct: null,
          },
        })
      ),
    })
    renderScreen(<MemberAnalyticsClient />)

    await screen.findByText('312')
    expect(screen.getByText('Retention —')).toBeInTheDocument()
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })

  /**
   * Each metric maps to its own series, and the mapping is a lookup table —
   * exactly the shape that silently plots the wrong numbers under the right
   * label if an entry is mistyped. The chart is stubbed, so this asserts the
   * data handed to it rather than the pixels.
   */
  it.each([
    ['Sign-ups', [1, 2, 3]],
    ['Active', [300, 306, 312]],
    ['Renewal %', [80, 81, 82]],
    ['Churn %', [9, 8, 7]],
    ['Retention %', [91, 92, 93]],
  ])('plots %s from its own series', async (label, expected) => {
    mockFetchRoutes({ '/api/analytics/members': apiOk(payload()) })
    renderScreen(<MemberAnalyticsClient />)
    await screen.findByText('312')

    fireEvent.click(screen.getByRole('button', { name: label }))

    await waitFor(() => {
      const trend = chartProps.filter((p) => p.type !== 'bar').at(-1)!
      expect((trend.data as { value: number }[]).map((d) => d.value)).toEqual(
        expected
      )
    })
  })

  it('refetches when the range changes', async () => {
    const fetchMock = mockFetchRoutes({
      '/api/analytics/members': apiOk(payload()),
    })
    renderScreen(<MemberAnalyticsClient />)
    await screen.findByText('312')

    fireEvent.click(screen.getByRole('button', { name: '3M' }))

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((c) => String(c[0]))
      expect(urls.some((u) => u.includes('range=3M'))).toBe(true)
    })
  })

  /**
   * Ruling from the visual sign-off: the selected segment used
   * `Button variant="primary"` — the near-white solid this app reserves for the
   * one call to action per screen — which made a range filter the brightest
   * element on the page, above the KPI values it exists to qualify (§5.11,
   * §5.19). It uses the app's selection fill instead.
   */
  it('marks the selected segment with the selection fill, not the primary solid', async () => {
    mockFetchRoutes({ '/api/analytics/members': apiOk(payload()) })
    renderScreen(<MemberAnalyticsClient />)
    await screen.findByText('312')

    for (const name of ['YTD', 'Sign-ups']) {
      const selected = screen.getByRole('button', { name, pressed: true })
      expect(selected.className).toContain('bg-surface-selected')
      expect(selected.className).not.toContain('bg-solid')
    }
  })

  it('exposes both segmented groups as pressed-state controls', async () => {
    mockFetchRoutes({ '/api/analytics/members': apiOk(payload()) })
    renderScreen(<MemberAnalyticsClient />)
    await screen.findByText('312')

    // Exactly one selection per group, expressed with aria-pressed so the
    // state is not colour-only.
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(2)
  })

  it('shows the year picker only for the one-year range', async () => {
    mockFetchRoutes({ '/api/analytics/members': apiOk(payload()) })
    renderScreen(<MemberAnalyticsClient />)
    await screen.findByText('312')

    expect(screen.queryByLabelText('Year')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '1Y' }))
    expect(await screen.findByLabelText('Year')).toBeInTheDocument()
  })

  it('renders the cohort grid, and says so when there are none', async () => {
    mockFetchRoutes({ '/api/analytics/members': apiOk(payload()) })
    const { unmount } = renderScreen(<MemberAnalyticsClient />)
    expect(await screen.findByText('Aug 2026')).toBeInTheDocument()
    unmount()

    mockFetchRoutes({
      '/api/analytics/members': apiOk(payload({ cohortRetention: [] })),
    })
    renderScreen(<MemberAnalyticsClient />)
    expect(await screen.findByText('No cohorts yet.')).toBeInTheDocument()
  })
})
