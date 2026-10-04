/**
 * @jest-environment node
 */

/**
 * POST /api/public/registrations — QR self-registration. The gym is resolved
 * from the token alone, and its name (for the welcome SMS) and admission fee
 * come from that gym's row through getGymRegistrationDetails — never from the
 * request. Pins what reaches RegisterMember, and that a missing or unreadable
 * gym row registers nobody.
 */

import { NextRequest } from 'next/server'
import { Member } from '@/features/members/domain/Member'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { PlanType } from '@/features/members/config/PlanConfig'

const execute = jest.fn()
const resolveRegistrationToken = jest.fn()
const getActivePlanForGym = jest.fn()
const getGymRegistrationDetails = jest.fn()

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/rate-limit', () => ({ checkRateLimit: jest.fn(() => true) }))
jest.mock('@/lib/storage/factory', () => ({ createStorageProvider: jest.fn() }))
jest.mock('@/features/members', () => ({
  createRegisterMember: jest.fn(() => ({ execute })),
  createMemberRepository: jest.fn(),
}))
jest.mock('@/features/registration/services/registration-link.service', () => ({
  resolveRegistrationToken: (...a: unknown[]) => resolveRegistrationToken(...a),
  getActivePlanForGym: (...a: unknown[]) => getActivePlanForGym(...a),
  getGymRegistrationDetails: (...a: unknown[]) =>
    getGymRegistrationDetails(...a),
}))

import { POST } from '../route'

const TOKEN = 'a'.repeat(32)

const validBody = {
  token: TOKEN,
  name: 'Nimal Perera',
  phoneNumber: '0771234567',
  planType: 'monthly',
  acceptedTerms: true,
  acceptedGymRules: true,
}

const post = (body: unknown) =>
  POST(
    new NextRequest('http://localhost/api/public/registrations', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.7' },
      body: JSON.stringify(body),
    })
  )

beforeEach(() => {
  execute.mockReset()
  resolveRegistrationToken.mockReset().mockResolvedValue('gym-1')
  getActivePlanForGym.mockReset().mockResolvedValue({ default_amount: 4000 })
  getGymRegistrationDetails
    .mockReset()
    .mockResolvedValue({ gymName: 'Titan Fitness', admissionFee: 500 })
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

describe('POST /api/public/registrations', () => {
  it("passes the token's gym, its name and the server-side amount to the registration", async () => {
    const res = await post(validBody)

    expect(res.status).toBe(201)
    expect(getGymRegistrationDetails).toHaveBeenCalledWith('gym-1')
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute.mock.calls[0][0]).toMatchObject({
      gymId: 'gym-1',
      gymName: 'Titan Fitness',
      planAmount: 4000,
      admissionFee: 500,
      paymentAmount: 4500,
    })
    const json = await res.json()
    expect(json.data.amountDue).toBe(4500)
  })

  it('ignores a gym name sent by the client', async () => {
    await post({ ...validBody, gymName: 'Spoofed Gym' })

    expect(execute.mock.calls[0][0].gymName).toBe('Titan Fitness')
  })

  it('answers 404 and registers nobody when the gym row is missing', async () => {
    getGymRegistrationDetails.mockResolvedValue(null)

    const res = await post(validBody)

    expect(res.status).toBe(404)
    expect(execute).not.toHaveBeenCalled()
  })

  it('answers 500 and registers nobody when the gym row cannot be read', async () => {
    getGymRegistrationDetails.mockRejectedValue(new Error('db down'))

    const res = await post(validBody)

    expect(res.status).toBe(500)
    expect(execute).not.toHaveBeenCalled()
  })

  it('answers 404 for an unknown token and reads no gym', async () => {
    resolveRegistrationToken.mockResolvedValue(null)

    const res = await post(validBody)

    expect(res.status).toBe(404)
    expect(getGymRegistrationDetails).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })

  it('refuses a body without both consents (400) and registers nobody', async () => {
    const res = await post({ ...validBody, acceptedTerms: false })

    expect(res.status).toBe(400)
    expect(execute).not.toHaveBeenCalled()
  })
})
