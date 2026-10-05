import { screen, within, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import MakeAnnouncementPage from '../page'
import { formatDate } from '@/utils/date/date'

// The gate passes on every paid tier today; the screen under test is the
// delivery log, not the entitlement check (which has server authority anyway).
jest.mock('@/features/subscriptions', () => ({
  __esModule: true,
  FeatureGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Polls its own endpoint on an interval; out of scope here, and it would make
// every test in this file wait on timers.
jest.mock('@/features/announcements/components/AnnouncementProgress', () => ({
  __esModule: true,
  default: () => null,
}))

const announcement = (i: number, over: Record<string, unknown> = {}) => ({
  id: `a${i}`,
  gym_id: 'g1',
  message: `Broadcast ${i}`,
  audience: 'all',
  recipient_count: 120,
  sent_count: 118,
  failed_count: 0,
  status: 'completed',
  sent_at: '2026-09-20T09:00:00Z',
  ...over,
})

const routes = (list: unknown[]) =>
  mockFetchRoutes({ '/api/announcements': apiOk(list) })

afterEach(() => jest.clearAllMocks())

describe('Announcements delivery log — phone tier', () => {
  it('renders rows instead of the four-column table', async () => {
    routes([announcement(1)])
    renderScreen(<MakeAnnouncementPage />, { viewport: 'phone' })

    // Await the CONTENT, not the role: the loading state is itself an `<li>`,
    // so `findAllByRole('listitem')` resolves on the skeleton and every
    // assertion after it reads "Loading…".
    await screen.findByText('Broadcast 1')
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(1)
    expect(screen.queryByRole('table')).toBeNull()

    const row = within(rows[0])
    expect(row.getByText('Broadcast 1')).toBeInTheDocument()
    expect(row.getByText('DELIVERED')).toBeInTheDocument()
    // §9.4: "sent · delivered" is the disclosed line, one text node (F10).
    expect(
      row.getByText(`sent 118/120 · ${formatDate('2026-09-20T09:00:00Z')}`)
    ).toBeInTheDocument()
  })

  it('names the failures on a partial send', async () => {
    routes([announcement(1, { failed_count: 2, sent_count: 116 })])
    renderScreen(<MakeAnnouncementPage />, { viewport: 'phone' })

    await screen.findByText('Broadcast 1')
    const row = within(screen.getAllByRole('listitem')[0])
    expect(row.getByText('PARTIAL')).toBeInTheDocument()
    expect(
      row.getByText(
        `sent 116/120 · 2 failed · ${formatDate('2026-09-20T09:00:00Z')}`
      )
    ).toBeInTheDocument()
  })

  it('says so when nothing has been sent', async () => {
    routes([])
    renderScreen(<MakeAnnouncementPage />, { viewport: 'phone' })
    expect(
      await screen.findByText('No announcements sent yet.')
    ).toBeInTheDocument()
  })

  /**
   * §27 "Maximum list size" — VERIFIED, not assumed: `getAnnouncements` selects
   * every row for the gym with no `.limit()` and no `.range()`, so the log is
   * uncapped and §27's "if uncapped, phone `pageSize` 25" applies. 26 rows is
   * the smallest fixture that can tell 25 from "all of them".
   */
  it('pages the log at 25 rows on a phone', async () => {
    routes(Array.from({ length: 26 }, (_, i) => announcement(i + 1)))
    renderScreen(<MakeAnnouncementPage />, { viewport: 'phone' })

    await screen.findByText('Broadcast 1')
    expect(screen.getAllByRole('listitem')).toHaveLength(25)
    expect(screen.queryByText('Broadcast 26')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByText('Broadcast 26')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  /**
   * The desktop table is unpaginated today and stays that way: adding a page
   * control there is a desktop change this phase does not own.
   */
  it('leaves the desktop table whole and unpaginated', async () => {
    routes(Array.from({ length: 26 }, (_, i) => announcement(i + 1)))
    renderScreen(<MakeAnnouncementPage />, { viewport: 'desktop' })

    await screen.findByText('Broadcast 26')
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(27) // 26 + the header
    expect(screen.queryByRole('button', { name: /next/i })).toBeNull()
  })

  /**
   * C2 and §8.18 both say the send behaviour is **unchanged**. The two-tap
   * confirm already in this screen is pre-existing product behaviour — "remove
   * the NEW confirmations" is about ones the plan proposed adding, not this
   * one. Pinned so a later reading of C2 cannot delete it.
   */
  it('keeps the existing two-tap send confirmation', async () => {
    routes([])
    renderScreen(<MakeAnnouncementPage />, { viewport: 'phone' })

    const message = await screen.findByLabelText('Message')
    fireEvent.change(message, { target: { value: 'Gym closed tomorrow' } })

    const send = screen.getByRole('button', { name: 'Send broadcast' })
    fireEvent.click(send)

    expect(
      screen.getByRole('button', { name: /^Confirm — send to all members$/ })
    ).toBeInTheDocument()
  })
})
