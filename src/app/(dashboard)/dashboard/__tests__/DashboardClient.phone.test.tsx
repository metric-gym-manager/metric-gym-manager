import { screen, within, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import DashboardClient from '../DashboardClient'

/**
 * The Dashboard on a phone (mobile rebuild plan §8.1, §9.4, §25.4, §26).
 *
 * The audit's charge against this screen was two-fold: the recent-payments
 * table is 461 px in a 390 px viewport, so the **Amount** column — the only
 * figure the section exists for — sat off the right edge; and the chart's
 * six-digit LKR ticks rendered as "0000". So the assertions here are about
 * what a row actually carries and where the axis formatter goes, not about the
 * screen mounting.
 *
 * A separate file from the desktop suite, which this phase does not edit.
 *
 * What it cannot see: whether any of it fits. jsdom computes no geometry, and
 * recharts is mocked away because it measures a container jsdom reports as
 * 0×0. The widths are the probe's and the numbers are in the rebuild log.
 */

const push = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn(), prefetch: jest.fn() }),
}))

jest.mock('@/features/members', () => ({
  __esModule: true,
  MemberAvatar: ({ name }: { name: string }) => (
    <span data-testid="member-avatar">{name.charAt(0)}</span>
  ),
  // Deep-required so the barrel's Supabase-bound exports stay out, and so the
  // NEW badge is driven by the real NEW_MEMBER_DAYS rather than a copy of it.
  isNewMember: jest.requireActual('@/features/members/utils/isNewMember')
    .isNewMember,
}))

const openMember = jest.fn()
jest.mock('@/contexts/member-modal.context', () => ({
  useMemberModal: () => ({ openMember: (id: string) => openMember(id) }),
}))

/**
 * Records what the chart was handed. The §5.9 axis fix is a PROP, and recharts
 * renders no axis in jsdom, so the prop is the only thing a unit test can see;
 * the rendered tick text is the probe's job (rule 8).
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

const metrics = {
  activeMembers: 312,
  revenueThisMonth: 486500,
  overdueMembers: { count: 14, warning: 8, mild: 6 },
  membersDueThisWeek: { count: 23, totalAmount: 92000 },
}

/** A payment old enough that the NEW badge is off unless a test asks for it. */
const payment = (over: Record<string, unknown> = {}) => ({
  paymentId: 'p1',
  memberId: 'm1',
  memberName: 'Sunil Fernando',
  planType: 'monthly',
  amountPaid: 5000,
  paymentDate: '2026-08-14',
  photoPath: null,
  photoUpdatedAt: null,
  memberCreatedAt: '2020-01-01T00:00:00Z',
  ...over,
})

const queueEntry = (over: Record<string, unknown> = {}) => ({
  memberId: 'q1',
  memberName: 'Janani Silva',
  planType: 'monthly',
  reminderType: 'due_today',
  scheduledInDays: 0,
  nextDueDate: '2026-09-15',
  amount: 3500,
  ...over,
})

const routes = (over: Record<string, unknown> = {}) => ({
  '/api/dashboard/metrics': { success: true, data: metrics },
  '/api/revenue/monthly': apiOk({
    historicalData: [
      { monthLabel: 'Jul 2026', collectedRevenue: 400000 },
      { monthLabel: 'Aug 2026', collectedRevenue: 486500 },
    ],
  }),
  '/api/payment-collection/collected': apiOk({
    payments: [payment()],
    summary: { totalRevenue: 5000, paymentCount: 1 },
  }),
  '/api/reminders/queue': apiOk({ entries: [queueEntry()], total: 1 }),
  ...over,
})

const renderPhone = (over: Record<string, unknown> = {}) => {
  mockFetchRoutes(routes(over))
  return renderScreen(<DashboardClient />, { viewport: 'phone' })
}

/** The `<li>` a piece of row text belongs to. */
const row = async (text: string | RegExp) =>
  (await screen.findByText(text)).closest('li')!

afterEach(() => {
  jest.clearAllMocks()
  barChartProps.length = 0
})

describe('Dashboard on a phone — recent payments', () => {
  it('renders the payments as list rows, not a table', async () => {
    renderPhone()
    await row('Sunil Fernando')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  /**
   * §9.4 row 4, the visible set: name (+NEW) and amount. The amount is the
   * column the 461 px table pushed off a 390 px screen, so its presence IN the
   * row — not merely somewhere on the page — is the defect's closing test.
   */
  it('shows the name and the amount in the row', async () => {
    renderPhone()
    const r = within(await row('Sunil Fernando'))
    expect(r.getByText('Sunil Fernando')).toBeInTheDocument()
    expect(r.getByText('5,000')).toBeInTheDocument()
  })

  /** §9.4, the disclosed set: plan · date, on the second line. */
  it('discloses the plan and the date on the second line', async () => {
    renderPhone()
    const r = await row('Sunil Fernando')
    expect(within(r).getByText('Monthly · 14 Aug 2026')).toBeInTheDocument()
  })

  /**
   * The desktop cell carries `capitalize`, and CSS capitalises after a hyphen:
   * that column reads "6-Months" at 1366 (verified in the browser). A joined
   * meta string gets no CSS help, so the same plan must not be spelled two
   * ways across the two tiers.
   */
  it('spells a hyphenated plan the way the desktop table does', async () => {
    renderPhone({
      '/api/payment-collection/collected': apiOk({
        payments: [payment({ planType: '6-months' })],
        summary: { totalRevenue: 5000, paymentCount: 1 },
      }),
    })
    const r = await row('Sunil Fernando')
    expect(within(r).getByText('6-Months · 14 Aug 2026')).toBeInTheDocument()
  })

  it('keeps the NEW badge beside the name, so the row stays two lines', async () => {
    renderPhone({
      '/api/payment-collection/collected': apiOk({
        payments: [payment({ memberCreatedAt: new Date().toISOString() })],
        summary: { totalRevenue: 5000, paymentCount: 1 },
      }),
    })
    const r = await row('Sunil Fernando')
    const badge = within(r).getByText('NEW')
    // §25.4: "Payments rows two-line + trailing value". The badge belongs to
    // the primary line; in the `status` slot it would push the meta to a third.
    expect(badge.closest('[class*="line-clamp-2"]')).not.toBeNull()
  })

  /** §8.1: "rows open member". The rest of a payment's detail lives there. */
  it('opens the member detail when a row is tapped', async () => {
    renderPhone()
    const r = within(await row('Sunil Fernando'))
    fireEvent.click(r.getByRole('button', { name: 'Sunil Fernando' }))
    expect(openMember).toHaveBeenCalledWith('m1')
  })

  it('renders at most six payments (§27 maximum list size)', async () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      payment({
        paymentId: `p${i}`,
        memberId: `m${i}`,
        memberName: `Member ${i}`,
      })
    )
    renderPhone({
      '/api/payment-collection/collected': apiOk({
        payments: many,
        summary: { totalRevenue: 45000, paymentCount: 9 },
      }),
    })
    await row('Member 0')
    expect(screen.queryByText('Member 6')).not.toBeInTheDocument()
  })

  it('shows the empty state when nothing was collected', async () => {
    renderPhone({
      '/api/payment-collection/collected': apiOk({
        payments: [],
        summary: { totalRevenue: 0, paymentCount: 0 },
      }),
    })
    expect(
      await screen.findByText('No payments collected this month yet.')
    ).toBeInTheDocument()
  })
})

describe('Dashboard on a phone — reminder queue', () => {
  /** §9.4 row 5, the visible set: name and amount. */
  it('shows the name and the amount in the row', async () => {
    renderPhone()
    const r = within(await row('Janani Silva'))
    expect(r.getByText('3,500')).toBeInTheDocument()
  })

  /** §9.4, disclosed: reminder type · when. */
  it('discloses the reminder type and when it fires', async () => {
    renderPhone()
    const r = await row('Janani Silva')
    expect(
      within(r).getByText('Due-today reminder · today')
    ).toBeInTheDocument()
  })

  /**
   * The meta line must be ONE text node. `ListRow` truncates a plain-text meta
   * line and WRAPS one holding an element (F10, F27) — the probe permits an
   * ellipsis only where the element holds nothing but text. Passing the two
   * segments as strings is what keeps this line on the truncating side.
   */
  it('joins the meta segments into a single text node', async () => {
    renderPhone()
    const meta = within(await row('Janani Silva')).getByText(
      'Due-today reminder · today'
    )
    expect(meta.childNodes).toHaveLength(1)
    expect(meta.childNodes[0].nodeType).toBe(Node.TEXT_NODE)
    expect(meta.className).toContain('truncate')
  })

  it('keeps the empty state when no reminder is scheduled', async () => {
    renderPhone({ '/api/reminders/queue': apiOk({ entries: [], total: 0 }) })
    expect(
      await screen.findByText('No reminders scheduled')
    ).toBeInTheDocument()
  })
})

describe('Dashboard on a phone — chart axis and header', () => {
  /** §5.9 / F1: a six-digit LKR tick does not fit the 40 px axis. */
  it('asks the chart for a compact axis', async () => {
    renderPhone()
    await screen.findByTestId('bar-chart')
    expect(barChartProps.at(-1)?.compactAxis).toBe(true)
  })

  /**
   * **Inverted at Phase 10, and the inversion is the point.** Phases 6–9 ran
   * this as "leaves the desktop axis alone", because the tick TEXT is what
   * `compactAxis` changes and a screen phase may not absorb its own diff into
   * a committed 1366 baseline (MO-4). The clip was real above `tablet` the
   * whole time (F1): re-measured at 768, 1024 and 1366, `250000`, `500000`
   * and `750000` were each cut by 12 px and `1000000` by 18.
   *
   * Phase 10 owns the baselines, so the prop now ships on both tiers and
   * `dashboard-desktop-1366` is a named re-baseline in the closeout. The
   * assertion is kept rather than deleted so the decision stays pinned in the
   * direction it actually points.
   */
  it('asks for the compact axis on the desktop too', async () => {
    mockFetchRoutes(routes())
    renderScreen(<DashboardClient />, { viewport: 'desktop' })
    await screen.findByTestId('bar-chart')
    expect(barChartProps.at(-1)?.compactAxis).toBe(true)
  })

  /**
   * §8.1 / §26: the AppBar carries "Overview", so the in-flow `<h1>` is
   * `sr-only` on a phone and the timestamp becomes the first visible row.
   */
  it('hides the page title and leaves the timestamp as a mono caption', async () => {
    renderPhone()
    await screen.findByTestId('bar-chart')
    const h1 = screen.getByRole('heading', { level: 1, name: 'Overview' })
    expect(h1.className).toContain('phone:sr-only')
    expect(screen.getByText(/IST$/).className).toContain('font-mono')
  })
})

describe('Dashboard on a phone — error state', () => {
  it('still renders the error card', async () => {
    renderPhone({ '/api/dashboard/metrics': { status: 500 } })
    expect(
      await screen.findByText(
        'Failed to load dashboard metrics. Please try again.'
      )
    ).toBeInTheDocument()
  })
})
