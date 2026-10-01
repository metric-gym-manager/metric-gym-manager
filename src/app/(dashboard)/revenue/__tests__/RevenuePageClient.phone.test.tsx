import { screen, within, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import RevenuePageClient from '../RevenuePageClient'

/**
 * Revenue on a phone (mobile rebuild plan §8.11, §9.4, §25.4, §26).
 *
 * The audit measured the breakdown table at 577 px in a 390 px viewport, with
 * **Collected** and **Share** — the two columns the section is read for —
 * past the right edge, and the chart's six-digit LKR ticks rendered as "0000".
 * So the assertions are about what a row carries and where the axis formatter
 * goes, not about the screen mounting.
 *
 * A separate file from the desktop suite, which this phase does not edit.
 *
 * What it cannot see: whether any of it fits, or how wide a share bar draws.
 * jsdom computes no geometry; the widths are the probe's.
 */

const barChartProps: Array<Record<string, unknown>> = []
jest.mock('@/components/ui/primitives/Charts', () => ({
  __esModule: true,
  BarChart: (props: Record<string, unknown>) => {
    barChartProps.push(props)
    return <div data-testid="bar-chart" />
  },
  LineChart: () => <div data-testid="line-chart" />,
  AreaChart: () => <div data-testid="area-chart" />,
}))

const monthly = {
  currentMonth: {
    billedRevenue: 516000,
    collectedRevenue: 486500,
    planCollectedRevenue: 486500,
    oneOffRevenue: 0,
    overdueMemberCount: 3,
  },
  metrics: { totalActiveMembers: 312, averageRevenuePerMember: 1560 },
  historicalData: [
    { monthLabel: 'Jul 2026', collectedRevenue: 400000 },
    { monthLabel: 'Aug 2026', collectedRevenue: 486500 },
  ],
}

const routes = (over: Record<string, unknown> = {}) => ({
  '/api/revenue/monthly': apiOk(monthly),
  '/api/payment-collection/collected': apiOk({
    payments: [
      { planType: 'monthly', amountPaid: 300000 },
      { planType: 'monthly', amountPaid: 100000 },
      { planType: 'annual', amountPaid: 86500 },
    ],
    summary: { totalRevenue: 486500, paymentCount: 3 },
  }),
  '/api/members/enrolment-by-plan': apiOk([
    { planType: 'monthly', activeCount: 280 },
    { planType: 'annual', activeCount: 20 },
  ]),
  ...over,
})

const renderPhone = (over: Record<string, unknown> = {}) => {
  mockFetchRoutes(routes(over))
  return renderScreen(<RevenuePageClient />, { viewport: 'phone' })
}

const row = async (text: string | RegExp) =>
  (await screen.findByText(text)).closest('li')!

afterEach(() => {
  jest.clearAllMocks()
  barChartProps.length = 0
})

describe('Revenue on a phone — breakdown by plan', () => {
  it('renders the breakdown as list rows, not a table', async () => {
    renderPhone()
    await row('Monthly')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  /**
   * §9.4 row 6, the visible set: plan, collected, share bar. Collected and
   * Share are exactly the two columns the 577 px table hid.
   */
  it('shows the plan, the collected total and the share bar in the row', async () => {
    renderPhone()
    const r = within(await row('Monthly'))
    expect(r.getByText('400,000')).toBeInTheDocument()
    expect(r.getByText('82%')).toBeInTheDocument()

    const bar = r.getByRole('progressbar', {
      name: 'Monthly share of collected revenue',
    })
    expect(bar).toHaveAttribute('aria-valuenow', '82')
  })

  /** §9.4, disclosed on the second line: members · payments. */
  it('discloses the member and payment counts on the second line', async () => {
    renderPhone()
    expect(
      within(await row('Monthly')).getByText('280 members · 2 payments')
    ).toBeInTheDocument()
  })

  /**
   * Nothing from the desktop's five columns is dropped without a home
   * (§9.4's closing rule): Plan, Members, Payments, Collected and Share are
   * all reachable from the row itself.
   */
  it('carries every desktop column somewhere in the row', async () => {
    renderPhone()
    const r = within(await row('Annual'))
    expect(r.getByText('Annual')).toBeInTheDocument()
    expect(r.getByText('20 members · 1 payment')).toBeInTheDocument()
    expect(r.getByText('86,500')).toBeInTheDocument()
    expect(r.getByText('18%')).toBeInTheDocument()
  })

  it('singularises a one-member, one-payment plan', async () => {
    renderPhone({
      '/api/payment-collection/collected': apiOk({
        payments: [{ planType: 'weekly', amountPaid: 1000 }],
        summary: { totalRevenue: 1000, paymentCount: 1 },
      }),
      '/api/members/enrolment-by-plan': apiOk([
        { planType: 'weekly', activeCount: 1 },
      ]),
    })
    expect(
      within(await row('Weekly')).getByText('1 member · 1 payment')
    ).toBeInTheDocument()
  })

  /** F10 / F27: a meta line holding an element wraps instead of truncating. */
  it('joins the meta segments into a single text node', async () => {
    renderPhone()
    const meta = within(await row('Monthly')).getByText(
      '280 members · 2 payments'
    )
    expect(meta.childNodes).toHaveLength(1)
    expect(meta.childNodes[0].nodeType).toBe(Node.TEXT_NODE)
    expect(meta.className).toContain('truncate')
  })

  it('shows the empty state for a month with no plan activity', async () => {
    renderPhone({
      '/api/payment-collection/collected': apiOk({
        payments: [],
        summary: { totalRevenue: 0, paymentCount: 0 },
      }),
      '/api/members/enrolment-by-plan': apiOk([]),
    })
    expect(
      await screen.findByText('No plan activity for this period.')
    ).toBeInTheDocument()
  })
})

describe('Revenue on a phone — period controls', () => {
  /**
   * §25.4: "Selects row `grid-cols-2 gap-2`". The pair is the page's first
   * content row, because `PageHeader`'s `<h1>` is `phone:sr-only` and the
   * AppBar carries no action slot (correction C7).
   */
  it('renders the month and year selects side by side, once each', async () => {
    renderPhone()
    const month = await screen.findByLabelText('Month')
    const year = screen.getByLabelText('Year')

    // Passing them as `PageHeader` actions AND as a content row renders two of
    // each on a phone — the trap Phase 4 recorded on the Members record count.
    expect(screen.getAllByLabelText('Month')).toHaveLength(1)
    expect(screen.getAllByLabelText('Year')).toHaveLength(1)

    const grid = month.closest('.grid')
    expect(grid).not.toBeNull()
    expect(grid?.className).toContain('grid-cols-2')
    expect(year.closest('.grid')).toBe(grid)
  })

  it('still drives the queries from the selects', async () => {
    const fetchMock = mockFetchRoutes(routes())
    renderScreen(<RevenuePageClient />, { viewport: 'phone' })
    await screen.findByLabelText('Month')

    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '3' } })

    await screen.findByText('Collected · Mar')
    expect(
      fetchMock.mock.calls.some((c) => String(c[0]).includes('month=3'))
    ).toBe(true)
  })
})

describe('Revenue on a phone — chart axis', () => {
  it('asks the chart for a compact axis', async () => {
    renderPhone()
    await screen.findByTestId('bar-chart')
    expect(barChartProps.at(-1)?.compactAxis).toBe(true)
  })

  /** Inverted at Phase 10 — see `DashboardClient.phone.test.tsx` for why. */
  it('asks for the compact axis on the desktop too', async () => {
    mockFetchRoutes(routes())
    renderScreen(<RevenuePageClient />, { viewport: 'desktop' })
    await screen.findByTestId('bar-chart')
    expect(barChartProps.at(-1)?.compactAxis).toBe(true)
  })
})

describe('Revenue on a phone — KPI band', () => {
  it('leaves the four readouts exactly as the desktop has them', async () => {
    renderPhone()
    expect(await screen.findByText('486,500')).toBeInTheDocument()
    expect(screen.getByText('516,000')).toBeInTheDocument()
    expect(screen.getByText('312')).toBeInTheDocument()
    expect(screen.getByText('1,560')).toBeInTheDocument()
    expect(screen.getByText(/94% collected/)).toBeInTheDocument()
  })
})
