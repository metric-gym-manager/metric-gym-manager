import { screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen } from '@/test-utils/renderScreen'
import DeviceStatusCard from '../components/DeviceStatusCard'
import type { SerializedAccessDevice } from '../utils/serializeAccessForAPI'

/**
 * What a reader's card says it holds (remote day F-13, visit 1 PH-16).
 *
 * The number is how many MEMBERS we hold on that reader, not how many
 * fingerprints it stores (a member with no finger yet still occupies a slot),
 * so the label says so. A reader with room and nothing on it still shows a
 * bar at 0 %: an empty bar and a missing bar read differently to the desk.
 */

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}))

const device = (
  over: Partial<SerializedAccessDevice> = {}
): SerializedAccessDevice => ({
  id: 'd1',
  deviceSerial: 'NYU7251900077',
  deviceName: 'Front Door',
  areaId: 1,
  timezoneOffsetMinutes: 330,
  isActive: true,
  lastSeenAt: '2026-10-09T08:40:00.000Z',
  templateCount: 4,
  templateCapacity: 100,
  capacityUsed: 0.04,
  clockDrifting: false,
  presence: 'online',
  ...over,
})

describe('DeviceStatusCard — members on this reader', () => {
  it('labels the count as members, with the figure and a bar', () => {
    renderScreen(<DeviceStatusCard device={device()} />)

    expect(screen.getByText('Members on this reader')).toBeInTheDocument()
    expect(screen.getByText('4 / 100')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.queryByText('Fingerprints')).not.toBeInTheDocument()
  })

  it('shows 0 / 100 with an empty bar, not a missing one', () => {
    renderScreen(
      <DeviceStatusCard
        device={device({ templateCount: 0, capacityUsed: 0 })}
      />
    )

    expect(screen.getByText('0 / 100')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('asks for the capacity when it is not known, rather than drawing a bar', () => {
    renderScreen(
      <DeviceStatusCard
        device={device({ templateCapacity: null, capacityUsed: null })}
      />
    )

    expect(screen.getByText('Members on this reader')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(
      screen.getByText(/Add this reader.s capacity in settings/i)
    ).toBeInTheDocument()
  })
})
