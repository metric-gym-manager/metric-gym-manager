import { screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes } from '@/test-utils/renderScreen'
import { formatDate } from '@/utils/date/date'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import type { MemberWithDiscount } from '../types'
import EditMemberModal from '../components/EditMemberModal'

/**
 * Edit member's read-only block printed `16/08/2026` while the rest of the
 * product prints `16 Aug 2026`; a day-first number also reads month-first to
 * anyone used to US dates.
 */
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

const member: MemberWithDiscount = {
  id: 'member-edit-1',
  gym_id: 'gym-1',
  member_number: 46,
  name: 'Fathima Herath',
  phone_number: '+94751230428',
  plan_type: 'monthly',
  plan_amount: 3500,
  discount_id: null,
  recurring_discount: false,
  status: MemberStatus.Active,
  registered_date: '2026-08-16',
  membership_start_date: '2026-08-16',
  next_due_date: '2026-09-16',
  created_at: '2026-08-16T00:00:00Z',
  updated_at: '2026-08-16T00:00:00Z',
  photo_path: null,
  photo_updated_at: null,
  registration_source: 'manual',
  verified_at: null,
  discount: null,
}

describe('EditMemberModal — read-only dates', () => {
  it('prints the registered and next-due dates in the product format', () => {
    mockFetchRoutes({
      '/api/billing-setup/plans': { data: [] },
      '/api/billing-setup/discounts': { data: [] },
    })
    renderScreen(<EditMemberModal open onClose={jest.fn()} member={member} />)

    expect(screen.getByText(formatDate('2026-08-16'))).toBeInTheDocument()
    expect(screen.getByText(formatDate('2026-09-16'))).toBeInTheDocument()
    expect(screen.queryByText('16/08/2026')).toBeNull()
  })
})
