/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const execute = jest.fn()

jest.mock('@/lib/middleware/auth', () => ({
  getCurrentGymProfile: jest.fn(() => Promise.resolve({ id: 'gym-1' })),
}))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/features/members', () => ({
  createRegisterMember: jest.fn(() => ({ execute })),
}))

import { POST } from '../route'

/**
 * POST /api/members/bulk. From July to October 2026 it refused every batch:
 * rows were validated with addMemberSchema after it gained two required
 * consents, and the grid sent neither. The grid now sends the batch's
 * attestation on every row; the route must accept it and record the consent
 * time exactly as single registration does.
 */

const row = (i: number, consents = true) => ({
  name: `Member ${i}`,
  phoneNumber: `07712345${String(i).padStart(2, '0')}`,
  planType: 'monthly',
  planAmount: 4000,
  paymentAmount: 4000,
  membershipStartDate: '2026-09-20',
  discountId: null,
  recurringDiscount: false,
  ...(consents ? { acceptedTerms: true, acceptedGymRules: true } : {}),
})

const post = (members: unknown[]) =>
  POST(
    new NextRequest('http://localhost/api/members/bulk', {
      method: 'POST',
      body: JSON.stringify({ members }),
    })
  )

beforeEach(() => {
  execute.mockReset()
  execute.mockImplementation(async () => ({ member: { id: 'm-1' } }))
})

describe('POST /api/members/bulk', () => {
  it('registers a batch the grid sends and records both consents', async () => {
    const res = await post([row(1), row(2)])

    expect(res.status).toBe(200)
    expect(execute).toHaveBeenCalledTimes(2)
    for (const [input] of execute.mock.calls) {
      expect(input.acceptedTermsAt).toBeInstanceOf(Date)
      expect(input.acceptedGymRulesAt).toBeInstanceOf(Date)
      expect(input.gymId).toBe('gym-1')
    }
  })

  it('refuses a batch whose rows carry no consent', async () => {
    const res = await post([row(1, false)])

    expect(res.status).toBe(400)
    expect(execute).not.toHaveBeenCalled()
  })
})
