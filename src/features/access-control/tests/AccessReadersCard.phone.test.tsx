import { screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import AccessReadersCard from '../components/AccessReadersCard'

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}))

const device = {
  id: 'd1',
  deviceSerial: 'NYU7251900066',
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
}

afterEach(() => jest.clearAllMocks())

/**
 * MO-10, settled by measurement.
 *
 * F9 deferred this twice on the premise that "a `Switch` has no wrapping
 * label: in `SettingsRow` the label sits beside it". That is false for the
 * switch's one product caller — this card already wraps it — but the
 * conclusion held for a different reason: the label measured **88×24** on a
 * phone, so neither the control nor its hit area reached §15.1's floor.
 *
 * §15.1's row for Checkbox/Radio/Switch is "control 24 px; 44 px label hit
 * area (label wraps the control)", so the fix belongs on the label, not on
 * the track: §5.2 specifies the 44×24 track verbatim and it stays. Measured
 * 88×44 after.
 *
 * jsdom computes no geometry (CLAUDE.md directive 1) — the browser pass is
 * what produced both numbers; this pins the class that carries them.
 */
describe('Readers card — the switch hit area', () => {
  it('puts the 44 px target on the label that wraps the switch', async () => {
    mockFetchRoutes({ '/api/access-control/devices': apiOk([device]) })
    renderScreen(<AccessReadersCard />, { viewport: 'phone' })

    const toggle = await screen.findByRole('switch', {
      name: 'Send changes to Reader 1',
    })
    const label = toggle.closest('label')

    // `htmlFor` is an association, not a hit area (F28) — it has to wrap.
    expect(label).not.toBeNull()
    expect(label).toHaveClass('phone:min-h-touch')
  })
})
