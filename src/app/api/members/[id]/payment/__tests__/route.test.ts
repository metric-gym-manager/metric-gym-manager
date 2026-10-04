/**
 * @jest-environment node
 */

/**
 * POST /api/members/[id]/payment — pins what this route hands CollectPayment:
 * the gym's name for the receipt or welcome-back SMS, from the session's gym
 * profile. `tsc` checks the property name, not the untyped value.
 */

import { NextRequest } from 'next/server'
import { Member } from '@/features/members/domain/Member'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { PlanType } from '@/features/members/config/PlanConfig'
import { Payment } from '@/features/payments/domain/Payment'

const execute = jest.fn()
const getCurrentGymProfile = jest.fn()

jest.mock('@/lib/middleware/auth', () => ({
  getCurrentGymProfile: () => getCurrentGymProfile(),
}))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/features/payments', () => ({
  createCollectPayment: jest.fn(() => ({ execute })),
}))
jest.mock('@/features/settings/services/settings.service', () => ({
  getDiscountInfoById: jest.fn(async () => null),
}))

import { POST } from '../route'

const MEMBER_ID = '11111111-1111-4111-8111-111111111111'

const validBody = {
  planAmount: 4000,
  paymentAmount: 4000,
  paymentDate: '2026-10-04',
}

const post = (body: unknown) =>
  POST(
    new NextRequest(`http://localhost/api/members/${MEMBER_ID}/payment`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: MEMBER_ID }) }
  )

beforeEach(() => {
  execute.mockReset()
  getCurrentGymProfile.mockReset()
  getCurrentGymProfile.mockResolvedValue({
    id: 'gym-1',
    gym_name: 'Titan Fitness',
  })
  execute.mockImplementation(async () => ({
    member: Member.create({
      gymId: 'gym-1',
      name: 'Nimal Perera',
      phoneNumber: '+94771234567',
      planType: PlanType.Monthly,
      planAmount: 4000,
      discountId: null,
      recurringDiscount: false,
      status: MemberStatus.Active,
      registeredDate: new Date(2026, 5, 4),
      membershipStartDate: new Date(2026, 5, 4),
      nextDueDate: new Date(2026, 10, 4),
    }),
    payment: Payment.create({
      memberId: MEMBER_ID,
      gymId: 'gym-1',
      paymentDate: new Date(2026, 9, 4),
      amountPaid: 4000,
      discountApplied: null,
      discountPercentage: null,
      nextDueDateCalculated: new Date(2026, 10, 4),
    }),
  }))
})

describe('POST /api/members/[id]/payment', () => {
  it("passes the session gym's id and name to the payment", async () => {
    const res = await post(validBody)

    expect(res.status).toBe(201)
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute.mock.calls[0][0]).toMatchObject({
      gymId: 'gym-1',
      gymName: 'Titan Fitness',
      memberId: MEMBER_ID,
      paymentAmount: 4000,
    })
  })

  it('refuses an invalid body (400) and collects nothing', async () => {
    const res = await post({ ...validBody, paymentAmount: -1 })

    expect(res.status).toBe(400)
    expect(execute).not.toHaveBeenCalled()
  })

  it('refuses a caller with no session (401) and collects nothing', async () => {
    getCurrentGymProfile.mockRejectedValue(new Error('Unauthorized'))

    const res = await post(validBody)

    expect(res.status).toBe(401)
    expect(execute).not.toHaveBeenCalled()
  })
})
