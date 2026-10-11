import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { toast } from 'sonner'
import { renderScreen, mockFetchRoutes } from '@/test-utils/renderScreen'
import DeviceStatusCard from '../components/DeviceStatusCard'
import type { SerializedAccessDevice } from '../utils/serializeAccessForAPI'

/**
 * The "Repair fingerprints" button on a reader card (visit 2, DEC2-09).
 *
 * The dialog carries the RB-3 warning: use it once the reader has been back on
 * for a minute, because a finger added at the reader while it was offline is
 * lost if the reader has not reconnected yet.
 */

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}))

const device: SerializedAccessDevice = {
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
}

function renderCard(membersQueued: number) {
  const fetchMock = mockFetchRoutes({
    '/api/access-control/devices/d1/repair': {
      success: true,
      data: { membersQueued },
    },
    '/api/access-control/devices': { success: true, data: [device] },
  })
  renderScreen(<DeviceStatusCard device={device} />)
  return fetchMock
}

const repairCalls = (fetchMock: jest.Mock) =>
  fetchMock.mock.calls.filter(
    ([url, init]) =>
      String(url).endsWith('/devices/d1/repair') &&
      (init as RequestInit | undefined)?.method === 'POST'
  )

async function openDialogAndConfirm() {
  fireEvent.click(
    screen.getByRole('button', { name: /^repair fingerprints$/i })
  )
  expect(
    await screen.findByText('Repair fingerprints on Front Door?')
  ).toBeInTheDocument()
  confirmInDialog()
}

/** The confirm button shares the trigger's label, so it is found inside the dialog. */
function confirmInDialog() {
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: /^repair fingerprints$/i,
    })
  )
}

describe('DeviceStatusCard — Repair fingerprints', () => {
  afterEach(() => jest.clearAllMocks())

  it('shows the warning in the dialog and calls the API once on confirm', async () => {
    const fetchMock = renderCard(3)

    fireEvent.click(
      screen.getByRole('button', { name: /^repair fingerprints$/i })
    )

    expect(
      await screen.findByText(
        /once the reader has been back on for at least a minute/i
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(/lost if the reader has not reconnected yet/i)
    ).toBeInTheDocument()
    expect(repairCalls(fetchMock)).toHaveLength(0)

    confirmInDialog()

    await waitFor(() => expect(repairCalls(fetchMock)).toHaveLength(1))
  })

  it('says how many members were queued', async () => {
    renderCard(3)

    await openDialogAndConfirm()

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'Repair queued for 3 members. Their fingerprints return within about 10 minutes.'
      )
    )
  })

  it('says so when the reader holds nobody', async () => {
    renderCard(0)

    await openDialogAndConfirm()

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'No members are on this reader.'
      )
    )
  })
})
