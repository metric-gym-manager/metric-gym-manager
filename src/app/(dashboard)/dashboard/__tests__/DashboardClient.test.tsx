import { screen, within, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import DashboardClient from '../DashboardClient'

const push = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn(), prefetch: jest.fn() }),
}))

jest.mock('@/features/members', () => ({
  __esModule: true,
  MemberAvatar: ({ name }: { name: string }) => (
    <span data-testid="member-avatar">{name.charAt(0)}</span>
  ),
  // The real implementation, deep-required so the barrel's Supabase-bound
  // exports stay out. Re-copying the rule here would let it drift from
  // NEW_MEMBER_DAYS, and the NEW badge is rendered from it.
  isNewMember: jest.requireActual('@/features/members/utils/isNewMember')
    .isNewMember,
}))

// Recharts measures its container, and jsdom reports every box as 0×0, so the
// chart renders nothing and floods stderr with width/height warnings. The
// chart's own behaviour is covered by the Charts primitive tests.
jest.mock('@/components/ui/primitives/Charts', () => ({
  __esModule: true,
  BarChart: () => <div data-testid="bar-chart" />,
  LineChart: () => <div data-testid="line-chart" />,
  AreaChart: () => <div data-testid="area-chart" />,
}))

const metrics = (over: Record<string, unknown> = {}) => ({
  activeMembers: 312,
  revenueThisMonth: 486500,
  overdueMembers: { count: 14, warning: 8, mild: 6 },
  membersDueThisWeek: { count: 23, totalAmount: 92000 },
  ...over,
})

const routes = (over: Record<string, unknown> = {}) => ({
  '/api/dashboard/metrics': { success: true, data: metrics() },
  '/api/revenue/monthly': apiOk({
    historicalData: [
      { monthLabel: 'Jul 2026', collectedRevenue: 400000 },
      { monthLabel: 'Aug 2026', collectedRevenue: 486500 },
    ],
  }),
  '/api/payment-collection/collected': apiOk({
    payments: [
      {
        paymentId: 'p1',
        memberId: 'm1',
        memberName: 'Sunil Fernando',
        planType: 'monthly',
        amountPaid: 5000,
        paymentDate: '2026-08-14',
        photoPath: null,
        photoUpdatedAt: null,
        memberCreatedAt: '2020-01-01T00:00:00Z',
      },
    ],
    summary: { totalRevenue: 5000, paymentCount: 1 },
  }),
  '/api/reminders/queue': apiOk({ entries: [], total: 0 }),
  ...over,
})

describe('DashboardClient', () => {
  afterEach(() => jest.clearAllMocks())

  it('renders every KPI value and its supporting line', async () => {
    mockFetchRoutes(routes())
    renderScreen(<DashboardClient />)

    expect(await screen.findByText('312')).toBeInTheDocument()
    expect(screen.getByText('486,500')).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText('23')).toBeInTheDocument()
    expect(screen.getByText('8 warning · 6 mild')).toBeInTheDocument()
    expect(screen.getByText('LKR 92,000 expected')).toBeInTheDocument()
  })

  /**
   * "Trailing 1 months" rendered on a new gym's dashboard — the same defect
   * class as the "1 records" count on /members, and equally invisible to every
   * automated check in the repo until someone loaded the page.
   */
  it('says "month" for one month of history and "months" otherwise', async () => {
    mockFetchRoutes(
      routes({
        '/api/revenue/monthly': apiOk({
          historicalData: [{ monthLabel: 'Aug 2026', collectedRevenue: 1 }],
        }),
      })
    )
    const { unmount } = renderScreen(<DashboardClient />)
    expect(
      await screen.findByText(/Revenue · Trailing 1 month$/)
    ).toBeInTheDocument()
    unmount()

    mockFetchRoutes(routes())
    renderScreen(<DashboardClient />)
    expect(
      await screen.findByText(/Revenue · Trailing 2 months$/)
    ).toBeInTheDocument()
  })

  it('renders recent payments, and says so when there are none', async () => {
    mockFetchRoutes(routes())
    const { unmount } = renderScreen(<DashboardClient />)
    expect(await screen.findByText('Sunil Fernando')).toBeInTheDocument()
    expect(screen.getByText('5,000')).toBeInTheDocument()
    unmount()

    mockFetchRoutes(
      routes({
        '/api/payment-collection/collected': apiOk({
          payments: [],
          summary: { totalRevenue: 0, paymentCount: 0 },
        }),
      })
    )
    renderScreen(<DashboardClient />)
    expect(
      await screen.findByText('No payments collected this month yet.')
    ).toBeInTheDocument()
  })

  it('shows queued reminders with their type and timing', async () => {
    mockFetchRoutes(
      routes({
        '/api/reminders/queue': apiOk({
          entries: [
            {
              memberId: 'm1',
              memberName: 'Anoma Jayasinghe',
              reminderType: 'reminder_3day',
              scheduledInDays: 3,
              amount: 4500,
            },
          ],
          total: 1,
        }),
      })
    )
    renderScreen(<DashboardClient />)

    expect(await screen.findByText('Anoma Jayasinghe')).toBeInTheDocument()
    expect(screen.getByText('3-day reminder · in 3 days')).toBeInTheDocument()
    expect(screen.getByText('1 queued')).toBeInTheDocument()
  })

  /**
   * The queue's day label special-cases 0 and 1 so it never reads "in 1 days"
   * or "in 0 days". Pinned because it is the same defect class as the two
   * count bugs above, in the one place that already handles it correctly.
   */
  it.each([
    [0, 'today'],
    [1, 'tomorrow'],
    [5, 'in 5 days'],
  ])('labels a reminder %i days out as "%s"', async (days, label) => {
    mockFetchRoutes(
      routes({
        '/api/reminders/queue': apiOk({
          entries: [
            {
              memberId: 'm1',
              memberName: 'Anoma',
              reminderType: 'overdue',
              scheduledInDays: days,
              amount: 100,
            },
          ],
          total: 1,
        }),
      })
    )
    renderScreen(<DashboardClient />)
    expect(
      await screen.findByText(`Overdue reminder · ${label}`)
    ).toBeInTheDocument()
  })

  it('shows an empty reminder queue as a message, not a blank column', async () => {
    mockFetchRoutes(routes())
    renderScreen(<DashboardClient />)
    expect(
      await screen.findByText('No reminders scheduled')
    ).toBeInTheDocument()
    expect(screen.getByText('0 queued')).toBeInTheDocument()
  })

  it('replaces the whole screen with an error when metrics fail', async () => {
    mockFetchRoutes(
      routes({ '/api/dashboard/metrics': { status: 500, body: {} } })
    )
    renderScreen(<DashboardClient />)

    expect(
      await screen.findByText(
        'Failed to load dashboard metrics. Please try again.'
      )
    ).toBeInTheDocument()
    // Not a page that shows an error banner over stale-looking zeroes.
    expect(screen.queryByText('Recent payments')).not.toBeInTheDocument()
  })

  /**
   * Each KPI is a route into the screen that acts on it — the dashboard's job
   * per §5.15 is to answer "what needs attention" and then hand you the tool.
   * The tiles navigate with `router.push` rather than an `<a href>`, so the
   * destination is only observable through the router.
   */
  it.each([
    ['Overdue members', '/payment-collection'],
    // The revenue tile is labelled with the current month name, so the
    // expected text is derived from the same clock rather than pinned to
    // whichever month this test was written in.
    [
      `Revenue · ${new Date().toLocaleString('en-US', { month: 'long' })}`,
      '/revenue',
    ],
    ['Expires this week', '/payment-collection'],
    ['Active members', '/members'],
  ])('sends %s to %s', async (label, href) => {
    mockFetchRoutes(routes())
    renderScreen(<DashboardClient />)
    await screen.findByText('312')

    fireEvent.click(screen.getByText(label))
    expect(push).toHaveBeenCalledWith(href)
  })

  it('holds the header clock back until hydration', async () => {
    mockFetchRoutes(routes())
    renderScreen(<DashboardClient />)
    await screen.findByText('312')

    // The stamp is minute-accurate, so rendering it on the server guarantees a
    // hydration mismatch on any request crossing a minute boundary. Whatever
    // it says, it must not be a server-rendered value: assert it appears at
    // all only after mount, via the client-only branch.
    const header = screen.getByRole('heading', { name: 'Overview' })
    expect(
      within(header.closest('div')!.parentElement!).getByText(/\d{4}/)
    ).toBeTruthy()
  })
})
