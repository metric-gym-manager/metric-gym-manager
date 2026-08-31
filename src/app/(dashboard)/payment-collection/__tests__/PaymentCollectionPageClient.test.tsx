import { screen, waitFor, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import PaymentCollectionPageClient from '../PaymentCollectionPageClient'

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

const toastSuccess = jest.fn()
const toastError = jest.fn()
jest.mock('sonner', () => ({
  toast: {
    success: (m: string) => toastSuccess(m),
    error: (m: string) => toastError(m),
  },
}))

/**
 * Radix Tabs activates a trigger on `mousedown`, not on `click` — a plain
 * `fireEvent.click` leaves the tab set exactly where it was and the assertion
 * then fails on the *next* tab's content being absent, which reads as a data
 * bug rather than an unsent event. `user-event` is not a dependency here.
 */
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

const routes = (over: Record<string, unknown> = {}) => ({
  '/api/regular-payments': {
    success: true,
    data: {
      payments: [
        due({ id: 'exp1', name: 'Expired Member', daysUntilDue: -12 }),
        due({ id: 'soon1', name: 'Soon Member', daysUntilDue: 3 }),
        due({ id: 'far1', name: 'Far Member', daysUntilDue: 40 }),
      ],
      totalCount: 3,
    },
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
  ...over,
})

describe('PaymentCollectionPageClient', () => {
  afterEach(() => jest.clearAllMocks())

  /**
   * The three tabs partition one fetched data set by `daysUntilDue`. A member
   * landing in the wrong bucket is a front-desk error — someone is chased for
   * money that is not due, or an expired member is not chased at all — and
   * nothing else in the suite exercises the boundaries.
   */
  it('routes each member to the right tab by days until due', async () => {
    mockFetchRoutes(routes())
    renderScreen(<PaymentCollectionPageClient />)

    expect(await screen.findByText('Expired Member')).toBeInTheDocument()
    expect(screen.queryByText('Soon Member')).not.toBeInTheDocument()

    selectTab(/Expires this week/)
    expect(await screen.findByText('Soon Member')).toBeInTheDocument()
    // 40 days out is neither expired nor due this week: it belongs to no tab.
    expect(screen.queryByText('Far Member')).not.toBeInTheDocument()

    selectTab(/Collected/)
    expect(await screen.findByText('Paid Member')).toBeInTheDocument()
  })

  it('shows a per-tab count on each tab', async () => {
    mockFetchRoutes(routes())
    renderScreen(<PaymentCollectionPageClient />)

    await screen.findByText('Expired Member')
    expect(
      within(screen.getByRole('tab', { name: /Expired/ })).getByText('1')
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('tab', { name: /Expires this week/ })).getByText(
        '1'
      )
    ).toBeInTheDocument()
  })

  /**
   * The SMS type is chosen from the same `daysUntilDue` the tab split uses, and
   * the four strings are the contract with the SMS feature. Sending a "3-day
   * reminder" to someone twelve days overdue is a real message to a real
   * customer, so the mapping is pinned at each boundary.
   */
  it.each([
    [-12, 'overdue'],
    [0, 'due_today'],
    [3, 'reminder_3day'],
    [7, 'reminder_7day'],
  ])('maps %i days until due to the %s reminder', async (days, expected) => {
    const fetchMock = mockFetchRoutes(
      routes({
        '/api/regular-payments': {
          success: true,
          data: {
            payments: [due({ id: 'x', name: 'Target', daysUntilDue: days })],
            totalCount: 1,
          },
        },
      })
    )
    renderScreen(<PaymentCollectionPageClient />)

    // Negative days land in Expired, non-negative in "Expires this week".
    if (days >= 0) {
      selectTab(/Expires this week/)
    }
    fireEvent.click(await screen.findByRole('button', { name: 'Remind' }))

    await waitFor(() => {
      const call = fetchMock.mock.calls.find((c) =>
        String(c[0]).includes('/api/sms/send')
      )
      expect(call).toBeDefined()
      expect(JSON.parse(String((call![1] as RequestInit).body))).toEqual({
        memberId: 'x',
        smsType: expected,
      })
    })
  })

  it('disables the remind button while its request is in flight', async () => {
    let release: (v: unknown) => void = () => {}
    const gate = new Promise((r) => {
      release = r
    })
    const base = routes()
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/sms/send')) {
        await gate
        return { ok: true, status: 200, json: async () => ({}) } as Response
      }
      const key = Object.keys(base).find((k) => url.includes(k))!
      return {
        ok: true,
        status: 200,
        json: async () => base[key as keyof typeof base],
      } as Response
    }) as unknown as typeof fetch

    renderScreen(<PaymentCollectionPageClient />)
    const button = await screen.findByRole('button', { name: 'Remind' })
    fireEvent.click(button)

    expect(
      await screen.findByRole('button', { name: 'Sending…' })
    ).toBeDisabled()
    release(null)
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('Reminder sent')
    )
  })

  it('reports a failed reminder to the user instead of silently succeeding', async () => {
    mockFetchRoutes(
      routes({ '/api/sms/send': { status: 500, body: { error: 'No credit' } } })
    )
    renderScreen(<PaymentCollectionPageClient />)
    fireEvent.click(await screen.findByRole('button', { name: 'Remind' }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('No credit'))
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('opens the member drawer from both row actions', async () => {
    mockFetchRoutes(routes())
    renderScreen(<PaymentCollectionPageClient />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Record payment' })
    )
    expect(openMember).toHaveBeenCalledWith('exp1')

    selectTab(/Collected/)
    fireEvent.click(await screen.findByRole('button', { name: 'Receipt' }))
    expect(openMember).toHaveBeenCalledWith('m9')
  })

  it('renders empty tabs as a message rather than a blank table', async () => {
    mockFetchRoutes(
      routes({
        '/api/regular-payments': {
          success: true,
          data: { payments: [], totalCount: 0 },
        },
      })
    )
    renderScreen(<PaymentCollectionPageClient />)
    expect(await screen.findByText('No expired members.')).toBeInTheDocument()
  })
})
