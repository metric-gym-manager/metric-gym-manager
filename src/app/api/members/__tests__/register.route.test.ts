/**
 * @jest-environment node
 */

/**
 * POST /api/members — desk registration. Pins what this route hands the
 * RegisterMember use case: the gym's name for the welcome SMS (every text
 * names the gym), read from the gym profile the session resolves to.
 *
 * `tsc` checks the property name `gym_name`, but the value comes from an
 * untyped Supabase row, so only a test can catch the wrong value travelling.
 * (The older suite beside this file, route.test.ts, tests a retired path and
 * is skipped.)
 */

import { NextRequest } from 'next/server'
import { Member } from '@/features/members/domain/Member'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { PlanType } from '@/features/members/config/PlanConfig'

const execute = jest.fn()
const getCurrentGymProfile = jest.fn()

jest.mock('@/lib/middleware/auth', () => ({
  getCurrentGymProfile: () => getCurrentGymProfile(),
}))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/features/registration', () => ({
  getGymAdmissionFee: jest.fn(async () => 0),
}))
jest.mock('@/features/members', () => ({
  createRegisterMember: jest.fn(() => ({ execute })),
  createMemberRepository: jest.fn(),
}))
jest.mock('@/features/access-control', () => ({
  provisionMemberAccessBestEffort: jest.fn(async () => undefined),
}))
jest.mock('@/features/settings/services/settings.service', () => ({
  getDiscountInfoById: jest.fn(async () => null),
  getDiscountsByIds: jest.fn(async () => []),
}))

import { POST } from '../route'

const validBody = {
  name: 'Nimal Perera',
  phoneNumber: '0771234567',
  planType: 'monthly',
  planAmount: 4000,
  paymentAmount: 4000,
  membershipStartDate: '2026-10-04',
  acceptedTerms: true,
  acceptedGymRules: true,
}

const post = (body: unknown) =>
  POST(
    new NextRequest('http://localhost/api/members', {
      method: 'POST',
      body: JSON.stringify(body),
    })
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
      registeredDate: new Date(2026, 9, 4),
      membershipStartDate: new Date(2026, 9, 4),
      nextDueDate: new Date(2026, 10, 4),
    }),
  }))
})

describe('POST /api/members', () => {
  it("passes the session gym's id and name to the registration", async () => {
    const res = await post(validBody)

    expect(res.status).toBe(201)
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute.mock.calls[0][0]).toMatchObject({
      gymId: 'gym-1',
      gymName: 'Titan Fitness',
      name: 'Nimal Perera',
    })
  })

  it('refuses a body without both consents (400) and registers nothing', async () => {
    const res = await post({ ...validBody, acceptedGymRules: false })

    expect(res.status).toBe(400)
    expect(execute).not.toHaveBeenCalled()
  })

  it('refuses a caller with no session (401) and registers nothing', async () => {
    getCurrentGymProfile.mockRejectedValue(new Error('Unauthorized'))

    const res = await post(validBody)

    expect(res.status).toBe(401)
    expect(execute).not.toHaveBeenCalled()
  })
})
