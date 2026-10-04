import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import { MemberSmsHistory } from '../components/MemberSmsHistory'

const entry = (over: Record<string, unknown> = {}) => ({
  id: 'log-1',
  smsType: 'reminder_3day',
  phoneNumber: '+94770000001',
  messageBody: 'Your membership is due in 3 days.',
  sentAt: '2026-09-01T04:30:00.000Z',
  deliveryStatus: 'delivered',
  textLkMessageId: 'vendor-1',
  ...over,
})

const history = (over: Record<string, unknown> = {}) =>
  apiOk({
    member: { id: 'm-1', name: 'Nimal', phoneNumber: '+94770000001' },
    entries: [entry()],
    totalCount: 1,
    page: 1,
    pageSize: 20,
    pageCount: 1,
    ...over,
  })

const expand = () =>
  fireEvent.click(screen.getByRole('button', { name: /View SMS History/i }))

describe('MemberSmsHistory', () => {
  afterEach(() => jest.clearAllMocks())

  /**
   * A member drawer is usually opened to take a payment, not to audit messaging.
   * Fetching on mount would put a query on every open for a panel most people
   * never expand.
   */
  it('fetches nothing until it is opened', async () => {
    const fetchMock = mockFetchRoutes({ '/sms-history': history() })
    renderScreen(<MemberSmsHistory memberId="m-1" />)

    expect(fetchMock).not.toHaveBeenCalled()
    expand()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  })

  it('lists a message with its time, type and body', async () => {
    mockFetchRoutes({ '/sms-history': history() })
    renderScreen(<MemberSmsHistory memberId="m-1" />)
    expand()

    expect(await screen.findByText('3-day reminder')).toBeInTheDocument()
    expect(
      screen.getByText('Your membership is due in 3 days.')
    ).toBeInTheDocument()
    expect(screen.getByText('1 message sent')).toBeInTheDocument()
  })

  it('counts messages in the singular at one', async () => {
    mockFetchRoutes({ '/sms-history': history({ totalCount: 4 }) })
    renderScreen(<MemberSmsHistory memberId="m-1" />)
    expand()
    expect(await screen.findByText('4 messages sent')).toBeInTheDocument()
  })

  /**
   * The distinction the `pending` migration exists to make. `sent` means handed
   * to the provider; only `delivered` is carrier-confirmed, so `sent` must not
   * be dressed as success — the old code collapsed PENDING onto sent and made
   * all three indistinguishable.
   */
  it.each([
    ['delivered', 'Delivered', 'text-success'],
    ['pending', 'Pending', 'text-warning'],
    ['failed', 'Failed', 'text-error'],
    ['sent', 'Sent', 'text-ink-secondary'],
  ])('shows %s distinctly', async (status, label, className) => {
    mockFetchRoutes({
      '/sms-history': history({ entries: [entry({ deliveryStatus: status })] }),
    })
    renderScreen(<MemberSmsHistory memberId="m-1" />)
    expand()

    const badge = await screen.findByText(label)
    expect(badge.className).toContain(className)
  })

  it('renders an empty history as a message, not a blank table', async () => {
    mockFetchRoutes({
      '/sms-history': history({ entries: [], totalCount: 0, pageCount: 1 }),
    })
    renderScreen(<MemberSmsHistory memberId="m-1" />)
    expand()
    expect(await screen.findByText('No messages yet')).toBeInTheDocument()
  })

  /**
   * Rule 2.8: a gym manager sees that it failed, never the provider's raw reason.
   * That text lives in `error_message`, which the endpoint does not return and
   * /system-health does.
   */
  it('reports a load failure without leaking technical detail', async () => {
    mockFetchRoutes({
      '/sms-history': { status: 500, body: { error: 'PGRST204 column x' } },
    })
    renderScreen(<MemberSmsHistory memberId="m-1" />)
    expand()

    expect(
      await screen.findByText('Could not load SMS history. Please try again.')
    ).toBeInTheDocument()
    expect(screen.queryByText(/PGRST/)).not.toBeInTheDocument()
  })

  it('pages through a long history', async () => {
    const fetchMock = mockFetchRoutes({
      '/sms-history': history({ totalCount: 45, pageCount: 3 }),
    })
    renderScreen(<MemberSmsHistory memberId="m-1" />)
    expand()

    await screen.findByText('3-day reminder')
    // The DS `Pagination` primitive replaced a hand-rolled Prev/Next pager —
    // a second implementation of a pattern the design system owns (§2.17),
    // whose `xs` buttons were 26 px. Its controls are icon buttons with
    // accessible names, and the current page carries `aria-current`.
    const pager = within(screen.getByRole('navigation', { name: 'Pagination' }))
    expect(pager.getByRole('button', { name: 'Page 1' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(pager.getByRole('button', { name: 'Previous page' })).toBeDisabled()

    fireEvent.click(pager.getByRole('button', { name: 'Next page' }))
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((c) => String(c[0]))
      expect(urls.some((u) => u.includes('page=2'))).toBe(true)
    })
  })

  it('hides the pager when everything fits on one page', async () => {
    mockFetchRoutes({ '/sms-history': history() })
    renderScreen(<MemberSmsHistory memberId="m-1" />)
    expand()

    await screen.findByText('3-day reminder')
    // `Pagination` renders nothing at all for a single page.
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  it('requests a bounded page rather than the whole history', async () => {
    const fetchMock = mockFetchRoutes({ '/sms-history': history() })
    renderScreen(<MemberSmsHistory memberId="m-1" />)
    expand()

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('page=1')
    expect(url).toContain('pageSize=20')
  })

  it('labels every message type the product can send', async () => {
    mockFetchRoutes({
      '/sms-history': history({
        entries: [
          entry({ id: '1', smsType: 'reminder_7day' }),
          entry({ id: '2', smsType: 'due_today' }),
          entry({ id: '3', smsType: 'overdue' }),
          entry({ id: '4', smsType: 'receipt' }),
          entry({ id: '5', smsType: 'welcome' }),
          entry({ id: '6', smsType: 'reactivation' }),
          entry({ id: '7', smsType: 'announcement' }),
        ],
        totalCount: 7,
      }),
    })
    renderScreen(<MemberSmsHistory memberId="m-1" />)
    expand()

    const table = within(await screen.findByRole('table'))
    // No raw enum value should reach the screen.
    for (const label of [
      '7-day reminder',
      'Due today',
      'Overdue notice',
      'Payment receipt',
      // A registration welcome is a welcome. Until 2026-10-04 announcements
      // were logged as `welcome`, so this label read "Announcement" and every
      // real welcome text was shown to the gym as an announcement.
      'Welcome',
      'Reactivation',
      'Announcement',
    ]) {
      expect(table.getByText(label)).toBeInTheDocument()
    }
    expect(table.queryByText(/reminder_7day|due_today/)).not.toBeInTheDocument()
  })
})
