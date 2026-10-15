import { screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { toast } from 'sonner'
import { renderScreen, mockFetchRoutes } from '@/test-utils/renderScreen'
import MemberAccessPanel from '@/features/access-control/components/MemberAccessPanel'
import type { MemberAccessStatus } from '@/features/access-control/types'

/**
 * "Record consent" inside the No-consent-recorded alert (visit 2, CD-3).
 *
 * The alert appears for a fingerprint added at the reader. The desk ticks that
 * the member agrees, then records it; the button stays dead until they do.
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
  explanation: 'Membership is active',
  fingerEnrolled: true,
  biometricConsentAt: null,
  validFrom: null,
  validTo: null,
  syncPending: false,
  syncFailed: false,
}

function renderPanel() {
  const fetchMock = mockFetchRoutes({
    // Listed first: the member route below is a prefix of this one.
    [`/api/access-control/members/${MEMBER}/consent`]: {
      success: true,
      data: { consentRecorded: true },
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

const consentCalls = (fetchMock: jest.Mock) =>
  fetchMock.mock.calls.filter(
    ([url, init]) =>
      String(url).endsWith(`/members/${MEMBER}/consent`) &&
      (init as RequestInit | undefined)?.method === 'POST'
  )

describe('MemberAccessPanel — recording consent for an existing fingerprint', () => {
  afterEach(() => jest.clearAllMocks())

  it('keeps Record consent disabled until the confirmation is ticked, then calls the API once', async () => {
    const fetchMock = renderPanel()

    const button = await screen.findByRole('button', {
      name: /^record consent$/i,
    })
    expect(button).toBeDisabled()

    fireEvent.click(
      screen.getByRole('checkbox', { name: /confirms they agree/i })
    )
    expect(button).toBeEnabled()

    fireEvent.click(button)

    await waitFor(() => expect(consentCalls(fetchMock)).toHaveLength(1))
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Consent recorded.')
    )
  })

  it("shows the server's message when recording fails", async () => {
    const fetchMock = mockFetchRoutes({
      [`/api/access-control/members/${MEMBER}/consent`]: {
        status: 502,
        body: {
          success: false,
          error: { message: 'Member not found', code: 'X' },
        },
      },
      '/api/settings/subscription': {
        success: true,
        data: { capabilities: { accessControlHardware: true } },
      },
      '/api/access-control/devices': { success: true, data: [] },
      [`/api/access-control/members/${MEMBER}`]: {
        success: true,
        data: status,
      },
    })
    renderScreen(<MemberAccessPanel memberId={MEMBER} />)

    fireEvent.click(
      await screen.findByRole('checkbox', { name: /confirms they agree/i })
    )
    fireEvent.click(screen.getByRole('button', { name: /^record consent$/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    expect(consentCalls(fetchMock)).toHaveLength(1)
    expect(toast.success).not.toHaveBeenCalled()
  })
})
