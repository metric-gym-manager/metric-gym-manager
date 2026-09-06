import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import RevenuePageClient from '../RevenuePageClient'

jest.mock('@/components/ui/primitives/Charts', () => ({
  __esModule: true,
  BarChart: () => <div data-testid="bar-chart" />,
  LineChart: () => <div data-testid="line-chart" />,
  AreaChart: () => <div data-testid="area-chart" />,
}))

const monthly = (over: Record<string, unknown> = {}) => ({
  currentMonth: {
    // `billedRevenue` replaced `projectedRevenue`: what billable members owe
    // this month from their due dates, not a run-rate valuation of the base.
    billedRevenue: 516000,
    // collectedRevenue is ALL cash; planCollectedRevenue is the part a
    // schedule predicts. Here there is no one-off money, so they match.
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
  ...over,
})

const routes = (over: Record<string, unknown> = {}) => ({
  '/api/revenue/monthly': apiOk(monthly()),
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
    { planType: 'weekly', activeCount: 12 },
  ]),
  ...over,
})

describe('RevenuePageClient', () => {
  afterEach(() => jest.clearAllMocks())

  it('renders the four revenue readouts', async () => {
    mockFetchRoutes(routes())
    renderScreen(<RevenuePageClient />)

    expect(await screen.findByText('486,500')).toBeInTheDocument()
    expect(screen.getByText('516,000')).toBeInTheDocument()
    // The tile is labelled for what it holds. "Projected" described a run-rate.
    expect(screen.getByText(/^Billed · /)).toBeInTheDocument()
    expect(screen.getByText('312')).toBeInTheDocument()
    expect(screen.getByText('1,560')).toBeInTheDocument()
  })

  /**
   * The rate compares like with like: plan cash against plan billings. Using
   * TOTAL cash as the numerator is what produced "127.7% of billed" on a real
   * gym — one-off money measured against a subscription denominator.
   */
  it('rates collection on plan cash, not total cash', async () => {
    mockFetchRoutes(
      routes({
        '/api/revenue/monthly': apiOk(
          monthly({
            currentMonth: {
              billedRevenue: 100000,
              collectedRevenue: 120000, // includes 40,000 of joining fees
              planCollectedRevenue: 80000,
              oneOffRevenue: 40000,
              overdueMemberCount: 0,
            },
          })
        ),
      })
    )
    renderScreen(<RevenuePageClient />)
    // 80,000 / 100,000 = 80%. Using the 120,000 total would read 120%.
    expect(await screen.findByText(/80% collected/)).toBeInTheDocument()
    expect(screen.queryByText(/120% collected/)).not.toBeInTheDocument()
  })

  /**
   * THE TAX FIGURE. A gym reports this month's revenue to the inland revenue
   * service from it, so the headline number must be ALL cash received — plan
   * payments, the admission fees inside them, and day passes — never a subset.
   *
   * An earlier revision of this page showed plan-only cash here for the sake of
   * a clean collection rate. That would have under-reported revenue the moment
   * a gym charged a joining fee, and disagreed with the dashboard for the same
   * month.
   */
  it('shows ALL cash received as the headline collected figure', async () => {
    mockFetchRoutes(
      routes({
        '/api/revenue/monthly': apiOk(
          monthly({
            currentMonth: {
              billedRevenue: 100000,
              collectedRevenue: 120000,
              planCollectedRevenue: 80000,
              oneOffRevenue: 40000,
              overdueMemberCount: 0,
            },
          })
        ),
      })
    )
    renderScreen(<RevenuePageClient />)

    expect(await screen.findByText('120,000')).toBeInTheDocument()
    // The plan-only subset must never be the headline.
    expect(screen.queryByText('80,000')).not.toBeInTheDocument()
    // And the one-off part is disclosed, so the total can be reconciled.
    expect(screen.getByText(/incl\. 40,000 joining fees/)).toBeInTheDocument()
  })

  it('does not divide by zero when nothing has been billed', async () => {
    mockFetchRoutes(
      routes({
        '/api/revenue/monthly': apiOk(
          monthly({
            currentMonth: {
              billedRevenue: 0,
              collectedRevenue: 0,
              planCollectedRevenue: 0,
              oneOffRevenue: 0,
              overdueMemberCount: 0,
            },
          })
        ),
      })
    )
    renderScreen(<RevenuePageClient />)
    await screen.findByText('312')
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument()
    expect(screen.queryByText(/% collected/)).not.toBeInTheDocument()
    // A month where nobody is due still states what the cash figure means.
    expect(screen.getByText('All cash received this month')).toBeInTheDocument()
  })

  /**
   * The label now states what its predicate actually tests.
   *
   * It used to read "Fully collected" in green whenever no member happened to
   * be past due — including on a new gym where COLLECTED was 0 and the tile
   * beside it read "0% of billed". Two tiles, side by side, asserting opposite
   * things.
   */
  it('reports overdue members, not a collection claim', async () => {
    mockFetchRoutes(routes())
    const { unmount } = renderScreen(<RevenuePageClient />)
    expect(await screen.findByText(/3 overdue/)).toBeInTheDocument()
    expect(screen.queryByText('Fully collected')).not.toBeInTheDocument()
    unmount()

    mockFetchRoutes(
      routes({
        '/api/revenue/monthly': apiOk(
          monthly({
            currentMonth: {
              billedRevenue: 100,
              collectedRevenue: 0,
              planCollectedRevenue: 0,
              oneOffRevenue: 0,
              overdueMemberCount: 0,
            },
          })
        ),
      })
    )
    renderScreen(<RevenuePageClient />)
    // Wait for DATA, not for the label: "No overdue members" would otherwise be
    // matched in the loading state, where the answer is not yet known.
    await screen.findByText('100')
    expect(screen.getByText(/0% collected/)).toBeInTheDocument()
    expect(screen.queryByText(/overdue/)).not.toBeInTheDocument()
    // The sub-line is a fragment (`{rate}% of billed` plus an optional
    // one-off clause), so the text spans nodes and needs a normalising matcher.
  })

  it('counts a single overdue member in the singular', async () => {
    mockFetchRoutes(
      routes({
        '/api/revenue/monthly': apiOk(
          monthly({
            currentMonth: {
              billedRevenue: 100,
              collectedRevenue: 0,
              planCollectedRevenue: 0,
              oneOffRevenue: 0,
              overdueMemberCount: 1,
            },
          })
        ),
      })
    )
    renderScreen(<RevenuePageClient />)
    expect(await screen.findByText(/1 overdue/)).toBeInTheDocument()
  })

  /**
   * Day-pass revenue is one-off: no membership schedule predicts it, so folding
   * it into the collected/billed ratio can push that ratio past 100%. It is
   * shown separately, and only when there is some.
   */
  it('shows one-off revenue separately, and only when present', async () => {
    mockFetchRoutes(routes())
    const { unmount } = renderScreen(<RevenuePageClient />)
    await screen.findByText('486,500')
    expect(screen.queryByText(/joining fees/)).not.toBeInTheDocument()
    expect(screen.getByText('All cash received this month')).toBeInTheDocument()
    unmount()

    mockFetchRoutes(
      routes({
        '/api/revenue/monthly': apiOk(
          monthly({
            currentMonth: {
              billedRevenue: 516000,
              collectedRevenue: 498500,
              planCollectedRevenue: 486500,
              oneOffRevenue: 12000,
              overdueMemberCount: 0,
            },
          })
        ),
      })
    )
    renderScreen(<RevenuePageClient />)
    expect(
      await screen.findByText(/incl\. 12,000 joining fees/)
    ).toBeInTheDocument()
  })

  /**
   * The plan breakdown is the union of plans that collected money this period
   * and plans with active enrolment — so a plan nobody has paid for yet still
   * shows its member count, and a plan that collected from a member who has
   * since left still shows its revenue. Losing either side of that union was
   * the risk in rewriting this table.
   */
  it('unions paying plans with enrolled plans', async () => {
    mockFetchRoutes(routes())
    renderScreen(<RevenuePageClient />)

    const monthlyRow = (await screen.findByText('Monthly')).closest('tr')!
    expect(within(monthlyRow).getByText('280')).toBeInTheDocument()
    expect(within(monthlyRow).getByText('400,000')).toBeInTheDocument()
    // 400000 / 486500 = 82.2% → 82
    expect(within(monthlyRow).getByText('82%')).toBeInTheDocument()

    // Enrolled but no revenue this period: still listed, at zero.
    const weeklyRow = screen.getByText('Weekly').closest('tr')!
    expect(within(weeklyRow).getByText('12')).toBeInTheDocument()
    expect(within(weeklyRow).getByText('0%')).toBeInTheDocument()
  })

  it('orders the breakdown by revenue', async () => {
    mockFetchRoutes(routes())
    renderScreen(<RevenuePageClient />)
    await screen.findByText('Monthly')

    const plans = screen
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.querySelector('td')?.textContent)
    expect(plans).toEqual(['Monthly', 'Annual', 'Weekly'])
  })

  it('refetches when the period changes', async () => {
    const fetchMock = mockFetchRoutes(routes())
    renderScreen(<RevenuePageClient />)
    await screen.findByText('486,500')

    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '3' } })

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((c) => String(c[0]))
      expect(
        urls.some(
          (u) => u.includes('/api/revenue/monthly') && u.includes('month=3')
        )
      ).toBe(true)
    })
  })
})
