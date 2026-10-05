import { screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes } from '@/test-utils/renderScreen'
import { formatDate } from '@/utils/date/date'
import { GetMemberAccessStatus } from '@/features/access-control/services/GetMemberAccessStatus'
import MemberAccessPanel from '@/features/access-control/components/MemberAccessPanel'
import type { MemberAccessStatus } from '@/features/access-control/types'
import { FakeAccessControlRepository, makeContext, day } from './fakes'

/**
 * The member detail's Door Access panel printed the reader's own date format:
 * "The readers will let this member in until 20261013, from 20260913."
 *
 * `YYYYMMDD` is what a ZKTeco terminal takes for StartDate/EndDate, and it
 * belongs on the sync path only. The status the panel reads is an API payload,
 * so its dates are ISO `YYYY-MM-DD` (rule 2.11), and the panel shows them the
 * way the rest of the product does (`formatDate`, "13 Oct 2026").
 */

const MEMBER = 'member-1'

describe('GetMemberAccessStatus — the validity window is ISO, not the device format', () => {
  it('returns YYYY-MM-DD for both ends of the window', async () => {
    const repo = new FakeAccessControlRepository({
      contexts: [
        makeContext({
          membershipStartDate: day('2026-09-13'),
          nextDueDate: day('2026-10-13'),
        }),
      ],
    })

    const status = await new GetMemberAccessStatus(repo).execute(
      'gym-1',
      MEMBER,
      day('2026-10-01')
    )

    expect(status?.allowed).toBe(true)
    expect(status?.validFrom).toBe('2026-09-13')
    expect(status?.validTo).toBe('2026-10-13')
  })
})

describe('MemberAccessPanel — prints the window as dates a person reads', () => {
  const status: MemberAccessStatus = {
    memberId: MEMBER,
    subjectId: 500001,
    allowed: true,
    explanation: 'Access is active',
    fingerEnrolled: true,
    biometricConsentAt: '2026-09-13T04:30:00.000Z',
    validFrom: '2026-09-13',
    validTo: '2026-10-13',
    syncPending: false,
    syncFailed: false,
  }

  beforeEach(() => {
    mockFetchRoutes({
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
  })

  afterEach(() => jest.restoreAllMocks())

  // Expected text comes from formatDate itself: ICU prints the en-GB short
  // month as "Sept" in current Node and Chrome, "Sep" in older ones.
  it('says from and until in the product date format', async () => {
    const { container } = renderScreen(<MemberAccessPanel memberId={MEMBER} />)

    expect(
      await screen.findByText(
        `The readers will let this member in from ${formatDate('2026-09-13')} until ${formatDate('2026-10-13')}.`
      )
    ).toBeInTheDocument()
    // No eight-digit device date anywhere in the panel.
    expect(container.textContent).not.toMatch(/\d{8}/)
  })

  it('dates the consent in the same format', async () => {
    renderScreen(<MemberAccessPanel memberId={MEMBER} />)

    expect(
      await screen.findByText(
        `Consent to record a fingerprint given on ${formatDate('2026-09-13T04:30:00.000Z')}.`
      )
    ).toBeInTheDocument()
  })
})
