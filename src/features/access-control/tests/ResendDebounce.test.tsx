import { screen, act, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes } from '@/test-utils/renderScreen'
import MemberAccessPanel from '@/features/access-control/components/MemberAccessPanel'
import type { MemberAccessStatus } from '@/features/access-control/types'

/**
 * "Re-send to readers" cannot be double-fired (remote day F-13).
 *
 * A re-send is a re-seat now: it deletes the member from every reader and adds
 * them back. A second click landing before the first finished would delete the
 * member again halfway through the first one's pushes. The button's loading
 * state is not enough — it only takes effect after React re-renders, and two
 * clicks inside one event-loop turn both see the enabled button.
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

const status: MemberAccessStatus = {
  memberId: MEMBER,
  subjectId: 100006,
  allowed: true,
  explanation: '',
  fingerEnrolled: false,
  biometricConsentAt: null,
  validFrom: null,
  validTo: null,
  syncPending: false,
  syncFailed: false,
}

function render() {
  const fetchMock = mockFetchRoutes({
    // Listed first: the member route below is a prefix of this one.
    [`/api/access-control/members/${MEMBER}/sync`]: {
      success: true,
      data: {
        allowed: true,
        commandsSent: 6,
        commandsPending: 0,
        failed: false,
      },
    },
    '/api/settings/subscription': {
      success: true,
      data: { capabilities: { accessControlHardware: true } },
    },
    '/api/access-control/devices': { success: true, data: [] },
    [`/api/access-control/members/${MEMBER}`]: { success: true, data: status },
  })

  renderScreen(<MemberAccessPanel memberId={MEMBER} />)
  return fetchMock
}

const syncCalls = (fetchMock: jest.Mock) =>
  fetchMock.mock.calls.filter(([url]) =>
    String(url).includes(`/members/${MEMBER}/sync`)
  )

describe('MemberAccessPanel — re-send is single-flight', () => {
  afterEach(() => jest.clearAllMocks())

  it('sends one request for two clicks in the same turn', async () => {
    const fetchMock = render()
    const button = await screen.findByRole('button', {
      name: /re-send to readers/i,
    })

    // Both clicks inside one act: React has not re-rendered between them, so
    // the button is still enabled for the second.
    act(() => {
      button.click()
      button.click()
    })

    await waitFor(() => expect(syncCalls(fetchMock)).toHaveLength(1))
    // And no late second request arrives afterwards.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(syncCalls(fetchMock)).toHaveLength(1)
  })

  it('allows another re-send once the first has finished', async () => {
    const fetchMock = render()
    const button = await screen.findByRole('button', {
      name: /re-send to readers/i,
    })

    act(() => {
      button.click()
    })
    await waitFor(() => expect(syncCalls(fetchMock)).toHaveLength(1))
    await waitFor(() => expect(button).toBeEnabled())

    act(() => {
      button.click()
    })

    await waitFor(() => expect(syncCalls(fetchMock)).toHaveLength(2))
  })
})
