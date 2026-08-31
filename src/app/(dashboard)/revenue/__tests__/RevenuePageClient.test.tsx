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
    collectedRevenue: 486500,
    projectedRevenue: 516000,
    hasOverduePayments: true,
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
    expect(screen.getByText('312')).toBeInTheDocument()
    expect(screen.getByText('1,560')).toBeInTheDocument()
  })

  it('states collection as a percentage of what was billed', async () => {
    mockFetchRoutes(routes())
    renderScreen(<RevenuePageClient />)
    // 486500 / 516000 = 94.28% → 94
    expect(await screen.findByText('94% of billed')).toBeInTheDocument()
  })

  it('does not divide by zero when nothing has been billed', async () => {
    mockFetchRoutes(
      routes({
        '/api/revenue/monthly': apiOk(
          monthly({
            currentMonth: {
              collectedRevenue: 0,
              projectedRevenue: 0,
              hasOverduePayments: false,
            },
          })
        ),
      })
    )
    renderScreen(<RevenuePageClient />)
    await screen.findByText('312')
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument()
    expect(screen.queryByText(/% of billed/)).not.toBeInTheDocument()
  })

  it('flags outstanding dues, and says so when there are none', async () => {
    mockFetchRoutes(routes())
    const { unmount } = renderScreen(<RevenuePageClient />)
    expect(
      await screen.findByText('Outstanding dues remain')
    ).toBeInTheDocument()
    unmount()

    mockFetchRoutes(
      routes({
        '/api/revenue/monthly': apiOk(
          monthly({
            currentMonth: {
              collectedRevenue: 100,
              projectedRevenue: 100,
              hasOverduePayments: false,
            },
          })
        ),
      })
    )
    renderScreen(<RevenuePageClient />)
    expect(await screen.findByText('Fully collected')).toBeInTheDocument()
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
