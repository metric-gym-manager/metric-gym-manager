import { screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { toast } from 'sonner'
import { renderScreen, mockFetchRoutes } from '@/test-utils/renderScreen'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { ConflictError, MemberLimitError } from '@/utils/errors'
import { MEMBER_CHANGED_MESSAGE } from '@/features/members/services/IMemberRepository'
import type { MemberWithDiscount } from '../types'
import DayPassModal from '../components/DayPassModal'

/**
 * What the Day Pass dialog does when the server refuses the pass.
 *
 * The two refusals that matter are the ones a gym can actually reach: the
 * active-member cap (a day pass on an expired member is a flip into active,
 * which the quota trigger refuses at a Lite gym's 100th member) and a second
 * submission for the same member (a double-tap, a retry, a second tab). The
 * bodies are built with the producers the route uses.
 */

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

const MEMBER_ID = 'member-day-pass-1'

const lapsed: MemberWithDiscount = {
  id: MEMBER_ID,
  gym_id: 'gym-1',
  member_number: 12,
  name: 'Nimal Perera',
  phone_number: '+94771234567',
  plan_type: 'monthly',
  plan_amount: 4000,
  discount_id: null,
  recurring_discount: false,
  status: MemberStatus.Expired,
  registered_date: '2026-06-04',
  membership_start_date: '2026-06-04',
  next_due_date: '2026-10-05',
  created_at: '2026-06-04T00:00:00Z',
  updated_at: '2026-06-04T00:00:00Z',
  photo_path: null,
  photo_updated_at: null,
  registration_source: 'manual',
  verified_at: null,
  discount: null,
}

function routes(dayPass: { status: number; body: unknown }) {
  return {
    [`/api/members/${MEMBER_ID}/day-pass`]: dayPass,
    '/api/members?': { success: true, data: { members: [lapsed] } },
    '/api/billing-setup/plans': {
      data: [{ plan_type: 'daily', is_active: true, default_amount: 500 }],
    },
    // `ReactivationLimitDialog` reads the subscription on mount.
    '/api/settings/subscription': { data: { subscription: {} } },
  }
}

async function issueFor(dayPass: { status: number; body: unknown }) {
  const fetchMock = mockFetchRoutes(routes(dayPass))
  renderScreen(<DayPassModal open onClose={jest.fn()} />)

  fireEvent.change(screen.getByLabelText('Search Member'), {
    target: { value: 'Nimal' },
  })
  fireEvent.click(await screen.findByText('Nimal Perera'))
  fireEvent.click(
    await screen.findByRole('button', { name: /Collect Rs\. 500 & Issue/ })
  )
  return fetchMock
}

afterEach(() => jest.clearAllMocks())

describe('DayPassModal — a refused day pass', () => {
  it('opens the upgrade dialog at the active-member cap, not an error toast', async () => {
    await issueFor({
      status: 403,
      body: ResponseBuilder.error(
        new MemberLimitError().message,
        'MEMBER_LIMIT_REACHED'
      ),
    })

    expect(
      await screen.findByRole('dialog', { name: 'Active member limit reached' })
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Upgrade to/ })).toHaveAttribute(
      'href',
      '/settings/billing'
    )
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('says another request got there first and returns to the search', async () => {
    const message = MEMBER_CHANGED_MESSAGE
    await issueFor({
      status: 409,
      body: ResponseBuilder.conflict(new ConflictError(message).message),
    })

    await screen.findByLabelText('Search Member')
    expect(toast.error).toHaveBeenCalledWith(message)
    // The member card showed the due date this request read, which is stale
    // now: the operator picks the member again from a fresh search.
    expect(
      screen.queryByRole('button', { name: 'Change' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('dialog', { name: 'Active member limit reached' })
    ).not.toBeInTheDocument()
  })

  it('says plainly that the pass failed when the server sends no reason', async () => {
    await issueFor({ status: 504, body: undefined })

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to issue day pass')
    )
  })
})
