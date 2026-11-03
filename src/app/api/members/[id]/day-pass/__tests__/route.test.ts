/**
 * @jest-environment node
 */

/**
 * POST /api/members/[id]/day-pass — pins what this route hands IssueDayPass:
 * the gym's name for the day-pass SMS, from the session's gym profile. `tsc`
 * checks the property name, not the untyped value.
 */

import { NextRequest } from 'next/server'
import { Member } from '@/features/members/domain/Member'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { PlanType } from '@/features/members/config/PlanConfig'
import { Payment, PaymentType } from '@/features/payments/domain/Payment'
import { ConflictError, MemberLimitError } from '@/utils/errors'

const execute = jest.fn()
const getCurrentGymProfile = jest.fn()

jest.mock('@/lib/middleware/auth', () => ({
  getCurrentGymProfile: () => getCurrentGymProfile(),
}))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/features/payments', () => ({
  createIssueDayPass: jest.fn(() => ({ execute })),
}))

import { POST } from '../route'

const MEMBER_ID = '11111111-1111-4111-8111-111111111111'

const post = (body: unknown) =>
  POST(
    new NextRequest(`http://localhost/api/members/${MEMBER_ID}/day-pass`, {
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
      nextDueDate: new Date(2026, 9, 5),
    }),
    payment: Payment.create({
      memberId: MEMBER_ID,
      gymId: 'gym-1',
      paymentDate: new Date(2026, 9, 4),
      amountPaid: 500,
      discountApplied: null,
      discountPercentage: null,
      nextDueDateCalculated: new Date(2026, 9, 5),
      paymentType: PaymentType.DayPass,
    }),
  }))
})

describe('POST /api/members/[id]/day-pass', () => {
  it("passes the session gym's id and name to the day pass", async () => {
    const res = await post({ amount: 500 })

    expect(res.status).toBe(201)
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute.mock.calls[0][0]).toMatchObject({
      gymId: 'gym-1',
      gymName: 'Titan Fitness',
      memberId: MEMBER_ID,
      amount: 500,
    })
  })

  it('refuses an invalid amount (400) and issues nothing', async () => {
    const res = await post({ amount: 0 })

    expect(res.status).toBe(400)
    expect(execute).not.toHaveBeenCalled()
  })

  it('refuses a caller with no session (401) and issues nothing', async () => {
    getCurrentGymProfile.mockRejectedValue(new Error('Unauthorized'))

    const res = await post({ amount: 500 })

    expect(res.status).toBe(401)
    expect(execute).not.toHaveBeenCalled()
  })

  it('answers 409 when another request changed the member first', async () => {
    execute.mockRejectedValue(
      new ConflictError(
        'This member was updated by another request. Reload and try again.'
      )
    )

    const res = await post({ amount: 500 })
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error.code).toBe('CONFLICT')
    expect(body.error.message).toBe(
      'This member was updated by another request. Reload and try again.'
    )
  })

  it('answers 403 MEMBER_LIMIT_REACHED at the active-member cap', async () => {
    execute.mockRejectedValue(new MemberLimitError())

    const res = await post({ amount: 500 })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('MEMBER_LIMIT_REACHED')
  })
})
