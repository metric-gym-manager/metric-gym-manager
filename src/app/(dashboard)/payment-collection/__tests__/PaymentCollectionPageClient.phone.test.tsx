import { screen, fireEvent, within, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import PaymentCollectionPageClient from '../PaymentCollectionPageClient'

/**
 * Renewals on a phone (mobile rebuild plan §8.10, §9.4, §25.4).
 *
 * The audit's charge against this screen was specific: **both row actions sat
 * off-screen**, the tab bar overflowed with no way to reach the third tab, and
 * the buttons were 26 px. So the assertions here are about reachability — that
 * each action exists in each row, that Record payment comes first, that the
 * tab list declares itself scrollable — rather than about the screen merely
 * mounting.
 *
 * A separate file from the desktop suite, which this phase does not touch.
 *
 * What it cannot see: whether any of it fits. jsdom computes no geometry; the
 * widths are the probe's, and the numbers are in the rebuild log.
 */

jest.mock('@/features/members', () => ({
  __esModule: true,
  MemberAvatar: ({ name }: { name: string }) => (
    <span data-testid="member-avatar">{name.charAt(0)}</span>
  ),
}))

const openMember = jest.fn()
jest.mock('@/contexts/member-modal.context', () => ({
  useMemberModal: () => ({ openMember: (id: string) => openMember(id) }),
}))

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

/** Radix Tabs activates on `mousedown`, not `click` (see the desktop suite). */
const selectTab = (name: RegExp | string) =>
  fireEvent.mouseDown(screen.getByRole('tab', { name }))

const due = (over: Record<string, unknown> = {}) => ({
  id: 'd1',
  name: 'Kamal Silva',
  planType: 'monthly',
  effectiveAmount: 4500,
  nextDueDate: '2026-09-02',
  daysUntilDue: 3,
  photoPath: null,
  photoUpdatedAt: null,
  ...over,
})

const routes = (payments = [due({ id: 'exp1', daysUntilDue: -299 })]) => ({
  '/api/regular-payments': {
    success: true,
    data: { payments, totalCount: payments.length },
  },
  '/api/payment-collection/collected': apiOk({
    payments: [
      {
        paymentId: 'p1',
        memberId: 'm9',
        memberName: 'Paid Member',
        planType: 'monthly',
        amountPaid: 5000,
        paymentDate: '2026-08-14',
        photoPath: null,
        photoUpdatedAt: null,
      },
    ],
    summary: { totalRevenue: 5000, paymentCount: 1 },
  }),
  '/api/sms/send': { ok: true },
})

const renderPhone = (payments?: ReturnType<typeof due>[]) => {
  mockFetchRoutes(routes(payments))
  return renderScreen(<PaymentCollectionPageClient />, { viewport: 'phone' })
}

/** The first REAL row — skeleton `<li>`s resolve first while a query is open. */
const row = async (text: string | RegExp) =>
  (await screen.findByText(text)).closest('li')!

afterEach(() => jest.clearAllMocks())

describe('Renewals on a phone — the audit’s headline defect', () => {
  it('renders BOTH actions in every row', async () => {
    renderPhone()
    const r = within(await row('Kamal Silva'))

    // Not "somewhere on the page": in the row. The audit's finding was that
    // the action column sat past the right edge of a 390 px screen, so the
    // buttons existed and could not be reached.
    expect(
      r.getByRole('button', { name: 'Record payment' })
    ).toBeInTheDocument()
    expect(r.getByRole('button', { name: 'Remind' })).toBeInTheDocument()
  })

  it('puts Record payment before Remind', async () => {
    renderPhone()
    const r = await row('Kamal Silva')
    const names = within(r)
      .getAllByRole('button')
      .map((b) => b.textContent)
    // §8.10. The desktop keeps Remind first; this is the one ordering
    // difference between the tiers and it is deliberate — collecting money is
    // the primary action on the screen whose job is collecting money.
    expect(names).toEqual(['Record payment', 'Remind'])
  })

  it('keeps both actions at the dense touch size, marked as dense', async () => {
    renderPhone()
    const r = within(await row('Kamal Silva'))
    for (const name of ['Record payment', 'Remind']) {
      const button = r.getByRole('button', { name })
      // §15.1 allows 40 px only for a control that says it is dense; without
      // the marker the probe holds it to 44 and the row fails at every width.
      expect(button).toHaveAttribute('data-dense')
      expect(button.className).toContain('phone:min-h-touch-sm')
    }
  })

  it('lets the tab list scroll, and declares it', async () => {
    renderPhone()
    const list = (await screen.findAllByRole('tab'))[0].closest(
      '[role="tablist"]'
    )
    // `data-scroll="x"` is the probe's sanctioned horizontal scroller. Without
    // it a scrolling tab list is exactly the silent overflow the audit found.
    expect(list).toHaveAttribute('data-scroll', 'x')
  })

  it('reaches all three tabs', async () => {
    renderPhone()
    await screen.findByText('Kamal Silva')
    for (const name of [/Expired/, /Expires this week/, /Collected/]) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument()
    }
    selectTab(/Collected/)
    expect(await screen.findByText('Paid Member')).toBeInTheDocument()
  })
})

describe('Renewals on a phone — §9.4 visible set', () => {
  it('shows name, how overdue, amount and the actions', async () => {
    renderPhone()
    const r = within(await row('Kamal Silva'))

    expect(r.getByText('Kamal Silva')).toBeInTheDocument()
    expect(r.getByText('299 days ago')).toBeInTheDocument()
    expect(r.getByText(/4,500/)).toBeInTheDocument()
    expect(r.getAllByRole('button')).toHaveLength(2)
  })

  it('shows the due DATE instead on the expires-this-week tab', async () => {
    renderPhone([due({ id: 'soon1', name: 'Soon Member', daysUntilDue: 3 })])
    await screen.findByRole('tab', { name: /Expires this week/ })
    selectTab(/Expires this week/)
    const r = within(await row('Soon Member'))
    // The same column id renders a days-ago badge on one tab and a date on
    // the other; the row maps the column, not the rendering.
    expect(r.getByText('2026-09-02')).toBeInTheDocument()
  })

  it('carries the avatar as the row leading, once', async () => {
    renderPhone()
    const r = within(await row('Kamal Silva'))
    expect(r.getAllByTestId('member-avatar')).toHaveLength(1)
  })

  it('renders no table', async () => {
    renderPhone()
    await row('Kamal Silva')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('Renewals on a phone — behaviour is unchanged', () => {
  it('sends the reminder on tap, with no confirmation (C2)', async () => {
    renderPhone()
    const r = within(await row('Kamal Silva'))

    fireEvent.click(r.getByRole('button', { name: 'Remind' }))

    // No dialog appears and the request goes immediately. The plan forbids
    // adding a confirm here: it would change the desktop's click count too.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // The mutation is async, so the call lands a tick after the click.
    const smsCall = () =>
      (
        (globalThis.fetch as jest.Mock).mock.calls as [string, RequestInit][]
      ).find(([url]) => url === '/api/sms/send')
    await waitFor(() => expect(smsCall()).toBeDefined())
    expect(JSON.parse(smsCall()![1].body as string)).toEqual({
      memberId: 'exp1',
      // -299 days is overdue, not a 3- or 7-day reminder.
      smsType: 'overdue',
    })
  })

  it('opens the member detail from Record payment, with no intent', async () => {
    renderPhone()
    fireEvent.click(
      within(await row('Kamal Silva')).getByRole('button', {
        name: 'Record payment',
      })
    )
    // `openMember(id)` and nothing else — the plan explicitly rejected an
    // `intent: 'pay'` option that would pre-open the payment dialog (o14).
    expect(openMember).toHaveBeenCalledWith('exp1')
    expect(openMember).toHaveBeenCalledTimes(1)
  })

  it('opens the member detail from Receipt', async () => {
    renderPhone()
    await screen.findByRole('tab', { name: /Collected/ })
    selectTab(/Collected/)
    fireEvent.click(
      within(await row('Paid Member')).getByRole('button', { name: 'Receipt' })
    )
    expect(openMember).toHaveBeenCalledWith('m9')
  })
})

describe('Renewals on a phone — pagination', () => {
  const many = Array.from({ length: 100 }, (_, i) =>
    due({ id: `d${i}`, name: `Member ${i}`, daysUntilDue: -(i + 1) })
  )

  it('pages at 25 and collapses the control', async () => {
    renderPhone(many)
    await screen.findByText('Member 0')

    // 100 dues is the §28 fixture. Unpaginated it is a scroll with no end;
    // the desktop is still unpaginated, which is today's behaviour there.
    expect(screen.queryByText('Member 25')).not.toBeInTheDocument()
    expect(await screen.findByText(/1 of 4/)).toBeInTheDocument()
  })

  it('moves to the next page', async () => {
    renderPhone(many)
    await screen.findByText('Member 0')
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('Member 25')).toBeInTheDocument()
    expect(screen.queryByText('Member 0')).not.toBeInTheDocument()
  })
})
