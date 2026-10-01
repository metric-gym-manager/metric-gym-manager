import { screen, within, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes } from '@/test-utils/renderScreen'
import AccessActivityLog from '../components/AccessActivityLog'
import { DeviceEventKind } from '../config/DeviceEventCodes'

const event = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  memberId: 'm-1',
  memberName: 'Nimal Perera',
  deviceSerial: 'VF-0099-FRONT',
  occurredAt: '2026-09-24T08:41:00.000Z',
  verifyType: 1,
  checkingStatus: 0,
  description: 'Entry granted',
  kind: DeviceEventKind.Granted,
  ...over,
})

const page = (events: unknown[], meta: Record<string, unknown> = {}) => ({
  success: true,
  data: events,
  meta: { page: 1, totalPages: 1, total: events.length, ...meta },
})

const routes = (events: unknown[], meta?: Record<string, unknown>) =>
  mockFetchRoutes({ '/api/access-control/events': page(events, meta) })

afterEach(() => jest.clearAllMocks())

/**
 * §8.15 + §9.4 "Access activity": who, the badge and when stay in the row and
 * the reader is disclosed on the meta line.
 *
 * C15 is explicit that this list keeps its plain `Table` on the desktop and
 * renders rows on a phone through the tier hook — no `Table` → `DataTable`
 * conversion. The desktop's `TableContainer` is `overflow-x-auto`, so on a
 * phone the four-column table never widened the page; it hid half its columns
 * inside a scroller with no visual cue.
 */
describe('Access activity — phone tier', () => {
  it('renders rows carrying every column the desktop table has', async () => {
    routes([event()])
    renderScreen(<AccessActivityLog />, { viewport: 'phone' })

    const rows = await screen.findAllByRole('listitem')
    expect(rows).toHaveLength(1)
    expect(screen.queryByRole('table')).toBeNull()

    const row = within(rows[0])
    expect(row.getByText('Nimal Perera')).toBeInTheDocument() // who
    expect(row.getByText('In')).toBeInTheDocument() // badge
    expect(row.getByText('Entry granted')).toBeInTheDocument() // what happened
    expect(row.getByText('VF-0099-FRONT')).toBeInTheDocument() // reader (meta)
  })

  /**
   * An unrecognised finger has no member to name, and those rows are how a gym
   * notices someone trying their luck at the door — so the row must still
   * render, with the absence stated rather than left blank (§27 "Partially
   * populated").
   */
  it('names an unrecognised scan rather than rendering a blank row', async () => {
    routes([event({ memberName: null, kind: DeviceEventKind.Denied })])
    renderScreen(<AccessActivityLog />, { viewport: 'phone' })

    const row = within((await screen.findAllByRole('listitem'))[0])
    expect(row.getByText('Not recognised')).toBeInTheDocument()
    expect(row.getByText('Refused')).toBeInTheDocument()
  })

  it('keeps the table on the desktop tier', async () => {
    routes([event()])
    renderScreen(<AccessActivityLog />, { viewport: 'desktop' })

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    // The columns the phone row discloses are still columns here.
    expect(screen.getByRole('columnheader', { name: 'Reader' })).toBeVisible()
  })

  /**
   * §26's DOOR ACCESS blueprint draws the compact "[‹ Prev] 1 of 4 [Next ›]"
   * pager. Numbered pages need seven 32 px targets in a row, which is the whole
   * width of a 320 px screen with nothing left for the count.
   */
  it('passes responsive to the pager so it collapses on a phone', async () => {
    routes([event()], { totalPages: 4 })
    renderScreen(<AccessActivityLog />, { viewport: 'phone' })
    await screen.findAllByRole('listitem')

    const pager = within(screen.getByRole('navigation', { name: 'Pagination' }))
    // The compact readout is the half `responsive` adds; both forms are in the
    // DOM and CSS hides one, which is why this asserts on presence.
    expect(pager.getByText('1 of 4')).toBeInTheDocument()
  })

  /**
   * §8.15: "chips touch height". Phase 1's `Button` compound sizing already
   * gives `size="sm"` the dense 40 px box on a phone and marks it `data-dense`
   * so the probe holds it to that floor — a verify, not a change. Pinned so a
   * later resize cannot silently drop it.
   */
  it('renders the filter chips as dense touch targets', async () => {
    routes([event()])
    renderScreen(<AccessActivityLog />, { viewport: 'phone' })
    await screen.findAllByRole('listitem')

    for (const label of ['All', 'Entries', 'Refusals', 'Alerts', 'Device']) {
      const chip = screen.getByRole('button', { name: label })
      expect(chip).toHaveAttribute('data-dense')
      expect(chip.className).toContain('phone:min-h-touch-sm')
    }
  })

  it('filters on the server rather than in the browser', async () => {
    const fetchMock = routes([event()])
    renderScreen(<AccessActivityLog />, { viewport: 'phone' })
    await screen.findAllByRole('listitem')

    fireEvent.click(screen.getByRole('button', { name: 'Alerts' }))

    const urls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(urls.some((u) => u.includes(`kind=${DeviceEventKind.Alarm}`))).toBe(
      true
    )
  })
})
