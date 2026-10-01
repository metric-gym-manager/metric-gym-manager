import { screen, within, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import { MemberSmsHistory } from '../components/MemberSmsHistory'
import { SmsDeliveryStatus } from '../config/SmsConfig'

/**
 * §28's 320-character fixture — two SMS segments, the longest body the compose
 * screen's own counter admits.
 */
const LONG_MESSAGE =
  'Dear member, your membership payment is now overdue. The gym will be closed ' +
  'for annual maintenance on Sunday and reopens Monday at 5am. Please settle ' +
  'the outstanding amount at reception before your next visit so your access ' +
  'card keeps working, or reply to this message and we will call you back. ' +
  'Thank you for your patience.'

const entry = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  smsType: 'reminder_3day',
  phoneNumber: '+94770001234',
  messageBody: 'Your membership is due in 3 days.',
  sentAt: '2026-09-24T08:41:00.000Z',
  deliveryStatus: SmsDeliveryStatus.Delivered,
  textLkMessageId: null,
  ...over,
})

const history = (entries: unknown[], over: Record<string, unknown> = {}) =>
  apiOk({
    entries,
    totalCount: entries.length,
    page: 1,
    pageSize: 20,
    pageCount: 1,
    ...over,
  })

const open = () =>
  fireEvent.click(screen.getByRole('button', { name: /View SMS History/ }))

afterEach(() => jest.clearAllMocks())

/**
 * §9.4 "SMS history": type, status and sent-at in the row; the message
 * disclosed, clamped to two lines, expanding on tap.
 *
 * MO-17 measured this table at 384 px on every phone width, inside the member
 * detail that Phase 3 made reachable on a phone — and because its wrapper is
 * `overflow-x-auto`, it hid the message column rather than widening the page.
 */
describe('SMS history — phone tier', () => {
  it('renders rows carrying the visible set, not the four-column table', async () => {
    mockFetchRoutes({ '/sms-history': history([entry()]) })
    renderScreen(<MemberSmsHistory memberId="m-1" />, { viewport: 'phone' })
    open()

    const rows = await screen.findAllByRole('listitem')
    expect(rows).toHaveLength(1)
    expect(screen.queryByRole('table')).toBeNull()

    const row = within(rows[0])
    expect(row.getByText('3-day reminder')).toBeInTheDocument() // type
    expect(row.getByText('Delivered')).toBeInTheDocument() // status
    expect(row.getByText(/24 Sep/)).toBeInTheDocument() // sent at
  })

  /**
   * §27 "Very long SMS / message": clamped to two lines in the row, tap expands
   * it to the full text. The clamp is a class jsdom cannot measure, so this
   * asserts the class and the toggle rather than a rendered height — and the
   * browser pass is what proves the two lines (CLAUDE.md directive 1).
   */
  it('clamps a 320-character message and expands it on tap', async () => {
    mockFetchRoutes({
      '/sms-history': history([entry({ messageBody: LONG_MESSAGE })]),
    })
    renderScreen(<MemberSmsHistory memberId="m-1" />, { viewport: 'phone' })
    open()

    const body = await screen.findByText(LONG_MESSAGE)
    expect(body.className).toContain('line-clamp-2')

    fireEvent.click(screen.getByRole('button', { name: '3-day reminder' }))
    expect(screen.getByText(LONG_MESSAGE).className).not.toContain(
      'line-clamp-2'
    )

    // And it closes again, rather than being a one-way reveal.
    fireEvent.click(screen.getByRole('button', { name: '3-day reminder' }))
    expect(screen.getByText(LONG_MESSAGE).className).toContain('line-clamp-2')
  })

  it('expands one row without expanding its neighbours', async () => {
    mockFetchRoutes({
      '/sms-history': history([
        entry({ id: 's1', messageBody: LONG_MESSAGE }),
        entry({
          id: 's2',
          smsType: 'receipt',
          messageBody: `Second ${LONG_MESSAGE}`,
        }),
      ]),
    })
    renderScreen(<MemberSmsHistory memberId="m-1" />, { viewport: 'phone' })
    open()
    await screen.findAllByRole('listitem')

    fireEvent.click(screen.getByRole('button', { name: '3-day reminder' }))

    expect(screen.getByText(LONG_MESSAGE).className).not.toContain(
      'line-clamp-2'
    )
    expect(screen.getByText(`Second ${LONG_MESSAGE}`).className).toContain(
      'line-clamp-2'
    )
  })

  it('keeps the table on the desktop tier', async () => {
    mockFetchRoutes({ '/sms-history': history([entry()]) })
    renderScreen(<MemberSmsHistory memberId="m-1" />, { viewport: 'desktop' })
    open()

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.getByRole('columnheader', { name: 'Message' })).toBeVisible()
  })

  /**
   * The hand-rolled Prev/Next pager this replaced was a second implementation
   * of a pattern the design system owns (§2.17), and its `xs` buttons were
   * 26 px. `responsive` is what collapses the numbered pages to Prev · "2 of 3"
   * · Next on a phone.
   */
  it('pages with the DS primitive in its compact form', async () => {
    mockFetchRoutes({
      '/sms-history': history([entry()], { totalCount: 45, pageCount: 3 }),
    })
    renderScreen(<MemberSmsHistory memberId="m-1" />, { viewport: 'phone' })
    open()
    await screen.findAllByRole('listitem')

    const pager = within(screen.getByRole('navigation', { name: 'Pagination' }))
    expect(pager.getByText('1 of 3')).toBeInTheDocument()
    expect(pager.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  })
})
