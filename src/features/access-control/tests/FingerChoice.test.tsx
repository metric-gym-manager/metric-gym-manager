import { screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes } from '@/test-utils/renderScreen'
import MemberAccessPanel from '@/features/access-control/components/MemberAccessPanel'
import type { MemberAccessStatus } from '@/features/access-control/types'
import type { SerializedAccessDevice } from '@/features/access-control/utils/serializeAccessForAPI'

/**
 * The desk chooses which finger to register (visit 2, CD-1).
 *
 * Every enrolment used to send slot 0, so a second finger replaced the first.
 * The panel now names the finger, defaults to the right index, and offers
 * "Register another finger" to a member who already has one.
 */

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}))

const MEMBER = 'member-1'

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

const status = (
  over: Partial<MemberAccessStatus> = {}
): MemberAccessStatus => ({
  memberId: MEMBER,
  subjectId: 100006,
  allowed: true,
  explanation: 'Membership is active',
  fingerEnrolled: false,
  // Consent already on file, so the consent tick does not gate the button.
  biometricConsentAt: '2026-10-01T00:00:00.000Z',
  validFrom: null,
  validTo: null,
  syncPending: false,
  syncFailed: false,
  ...over,
})

function renderPanel(over: Partial<MemberAccessStatus> = {}) {
  const fetchMock = mockFetchRoutes({
    // Listed first: `/enrol` is a prefix of `/enrolment`, and both are
    // prefixes of the member route.
    [`/api/access-control/members/${MEMBER}/enrolment`]: {
      success: true,
      data: { enrolled: false },
    },
    [`/api/access-control/members/${MEMBER}/enrol`]: {
      success: true,
      data: { awaitingFinger: true },
    },
    '/api/settings/subscription': {
      success: true,
      data: { capabilities: { accessControlHardware: true } },
    },
    '/api/access-control/devices': { success: true, data: [device] },
    [`/api/access-control/members/${MEMBER}`]: {
      success: true,
      data: status(over),
    },
  })

  renderScreen(<MemberAccessPanel memberId={MEMBER} />)
  return fetchMock
}

describe('MemberAccessPanel — choosing the finger', () => {
  it('defaults to the right index finger', async () => {
    renderPanel()

    const select = await screen.findByLabelText('Finger to register')

    expect(select).toHaveValue('6')
    expect(
      (
        screen.getByRole('option', {
          name: 'Right index finger',
        }) as HTMLOptionElement
      ).selected
    ).toBe(true)
  })

  it('sends the chosen slot when the desk registers a left thumb', async () => {
    const fetchMock = renderPanel()

    const select = await screen.findByLabelText('Finger to register')
    fireEvent.change(select, { target: { value: '4' } })
    fireEvent.click(
      screen.getByRole('button', { name: /register fingerprint/i })
    )

    await waitFor(() => {
      const enrol = fetchMock.mock.calls.find(([url]) =>
        String(url).endsWith(`/members/${MEMBER}/enrol`)
      )
      expect(enrol).toBeDefined()
      expect(JSON.parse(String(enrol?.[1]?.body))).toMatchObject({
        deviceId: 'd1',
        fingerId: 4,
      })
    })
  })

  it('offers another finger, beside Remove, to a member who already has one', async () => {
    renderPanel({ fingerEnrolled: true })

    expect(
      await screen.findByRole('button', { name: /remove fingerprint/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /register another finger/i })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Each finger is kept separately. Registering the same finger again replaces it.'
      )
    ).toBeInTheDocument()
  })

  it('reads "Register fingerprint" for a member with no fingerprint', async () => {
    renderPanel({ fingerEnrolled: false })

    expect(
      await screen.findByRole('button', { name: /^register fingerprint$/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /register another finger/i })
    ).not.toBeInTheDocument()
  })
})
