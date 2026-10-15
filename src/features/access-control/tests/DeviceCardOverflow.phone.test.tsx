import { screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import AccessControlDashboard from '../components/AccessControlDashboard'

jest.mock('../hooks/useAccessControl', () => {
  const actual = jest.requireActual('../hooks/useAccessControl')
  return {
    ...actual,
    useOpenAccessDevice: () => ({ mutateAsync: jest.fn(), isPending: false }),
    useRebootAccessDevice: () => ({ mutateAsync: jest.fn(), isPending: false }),
    useFreeAccessDeviceSpace: () => ({
      mutateAsync: jest.fn(),
      isPending: false,
    }),
  }
})

jest.mock('@/hooks/use-confirm-dialog', () => ({
  useConfirmDialog: () => ({
    confirm: jest.fn().mockResolvedValue(true),
    dialog: null,
  }),
}))

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}))

/** 58 characters — free text a gym types, well inside the 100-char schema max. */
const LONG_NAME = 'Front door — main entrance (Ground floor, turnstile bank A)'

/** The vendor's own documented serial (`docs/integrations/vft/vft-api-reference.md`). */
const REAL_SERIAL = 'NYU7251900066'

const device = (over: Record<string, unknown> = {}) => ({
  id: 'd1',
  deviceSerial: REAL_SERIAL,
  deviceName: 'Reader 1',
  areaId: 1,
  timezoneOffsetMinutes: 330,
  isActive: true,
  lastSeenAt: '2026-09-24T08:40:00.000Z',
  templateCount: 1024,
  templateCapacity: 3000,
  capacityUsed: 0.34,
  clockDrifting: false,
  presence: 'online',
  ...over,
})

const routes = (devices: unknown[]) =>
  mockFetchRoutes({
    '/api/access-control/account': apiOk({
      id: 'acc-1',
      baseUrl: 'https://vft.example.com',
      areaId: 1,
      isActive: true,
      verified: true,
      lastVerifiedAt: '2026-09-24T07:00:00.000Z',
    }),
    '/api/access-control/devices': apiOk(devices),
    '/api/access-control/events': {
      success: true,
      data: [],
      meta: { page: 1, totalPages: 1, total: 0 },
    },
  })

afterEach(() => jest.clearAllMocks())

/**
 * Two width defects measured on the real screen at 320, both invisible to
 * jsdom and to every other gate — the Phase 9 prompt said these cards "already
 * stack below `tablet` — verify only", which was true about stacking and false
 * about fitting.
 *
 * jsdom computes no geometry, so these assert the two classes that carry the
 * fix and the browser pass is what proves the widths (CLAUDE.md directive 1).
 * The numbers in each case are from Chromium at a 320 px device.
 */
describe('Device cards — width at the narrowest phone', () => {
  /**
   * `grid gap-3 md:grid-cols-2` declares no column template below `md`, so the
   * implicit single track is `auto` — floored by its items' MAX-content. The
   * `truncate` on the device-name `h3` sets `white-space: nowrap`, which makes
   * that max-content the whole untruncated string: `overflow: hidden` clips
   * what is painted, it does not shrink what the track asks for. An ordinary
   * 26-character name ("Front door — main entrance") pushed the layout
   * viewport to 363 on a 320 device, and the 58-character one to 572 — the
   * whole page zoomed out, cards and activity log alike.
   *
   * `grid-cols-1` is `repeat(1, minmax(0, 1fr))`. The 0 minimum is the entire
   * fix, and it is inert from `md` up, where the explicit templates already
   * win.
   */
  it('caps the implicit grid track so a long device name cannot widen the page', async () => {
    routes([device({ deviceName: LONG_NAME })])
    renderScreen(<AccessControlDashboard />, { viewport: 'phone' })

    const name = await screen.findByText(LONG_NAME)
    const grid = name.closest('div.grid')
    expect(grid).not.toBeNull()
    expect(grid).toHaveClass('grid-cols-1')
  })

  /**
   * The serial sits under the name in a `min-w-0` column and had no wrapping
   * rule of its own, so an unbreakable value overflowed its box and widened
   * the page: at the schema maximum (64 chars, `registerDeviceSchema`) the
   * `<p>`'s scrollWidth was 422 in a 181 px box and the layout viewport went
   * to 459 even with the grid capped.
   *
   * `break-all` rather than the sibling `h3`'s `truncate`: a serial is the one
   * field a gym reads back to support off this screen, and an ellipsis
   * destroys it. It is inert at the vendor's own 13-character format, which
   * fits on one line and never breaks.
   */
  it('wraps an unbreakable serial instead of letting it overflow', async () => {
    routes([device({ deviceSerial: 'A'.repeat(64) })])
    renderScreen(<AccessControlDashboard />, { viewport: 'phone' })

    const serial = await screen.findByText('A'.repeat(64))
    expect(serial).toHaveClass('break-all')
  })

  it('still renders the vendor-format serial in full', async () => {
    routes([device()])
    renderScreen(<AccessControlDashboard />, { viewport: 'phone' })

    expect(await screen.findByText(REAL_SERIAL)).toBeInTheDocument()
  })
})
