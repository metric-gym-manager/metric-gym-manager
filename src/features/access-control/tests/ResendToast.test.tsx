import { screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { toast } from 'sonner'
import { renderScreen, mockFetchRoutes } from '@/test-utils/renderScreen'
import MemberAccessPanel from '@/features/access-control/components/MemberAccessPanel'
import type { MemberAccessStatus } from '@/features/access-control/types'

/**
 * What "Re-send to readers" tells the desk.
 *
 * A run that sent nothing used to toast "Readers updated" — a claim about the
 * hardware made on the strength of zero commands. The route now forces, so
 * nothing-sent means one thing only: the member cannot get in and was never
 * on a reader. The desk is told that, not that the readers changed.
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
  allowed: false,
  explanation: 'Membership is suspended',
  fingerEnrolled: false,
  biometricConsentAt: null,
  validFrom: null,
  validTo: null,
  syncPending: false,
  syncFailed: false,
}

function renderWithSyncResult(result: Record<string, unknown>) {
  mockFetchRoutes({
    // Listed first: the member route below is a prefix of this one.
    [`/api/access-control/members/${MEMBER}/sync`]: {
      success: true,
      data: result,
    },
    '/api/settings/subscription': {
      success: true,
      data: { capabilities: { accessControlHardware: true } },
    },
    '/api/access-control/devices': { success: true, data: [] },
    [`/api/access-control/members/${MEMBER}`]: { success: true, data: status },
  })

  renderScreen(<MemberAccessPanel memberId={MEMBER} />)
}

describe('MemberAccessPanel — the re-send toast', () => {
  afterEach(() => jest.clearAllMocks())

  it('says nothing was sent when nothing was, never "Readers updated"', async () => {
    renderWithSyncResult({
      allowed: false,
      commandsSent: 0,
      commandsPending: 0,
      failed: false,
    })

    fireEvent.click(
      await screen.findByRole('button', { name: /re-send to readers/i })
    )

    await waitFor(() => expect(toast.info).toHaveBeenCalledTimes(1))
    expect(String((toast.info as jest.Mock).mock.calls[0][0])).toMatch(
      /nothing to send/i
    )
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('reports queued commands as on their way', async () => {
    renderWithSyncResult({
      allowed: true,
      commandsSent: 6,
      commandsPending: 6,
      failed: false,
    })

    fireEvent.click(
      await screen.findByRole('button', { name: /re-send to readers/i })
    )

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'Queued — the readers will pick this up shortly'
      )
    )
    expect(toast.info).not.toHaveBeenCalled()
  })
})
