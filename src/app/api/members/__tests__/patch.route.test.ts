/**
 * @jest-environment node
 */

/**
 * PATCH /api/members/[id]
 *
 * The route holds auth, validation and one use-case call (architecture rule
 * 2.4); what the use case does is pinned in `UpdateMemberProfile.test.ts`.
 * These pin the seam: who the member and the gym are taken from, what the
 * schema lets through, and how each failure is reported.
 *
 * Mocked at the use-case boundary, so this cannot see Supabase or RLS — a
 * live PATCH is the only thing that can.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ConflictError, NotFoundError, ValidationError } from '@/utils/errors'

const mockExecute = jest.fn()
const mockPushMember = jest.fn()

jest.mock('@/lib/middleware/api-auth', () => ({
  getApiGymProfile: jest.fn(),
}))
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({})),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => ({})),
}))
jest.mock('@/features/members', () => ({
  createMemberRepository: jest.fn(),
  createUpdateMemberProfile: jest.fn(() => ({ execute: mockExecute })),
}))
jest.mock('@/features/access-control', () => ({
  createPushRename: jest.fn(() => ({ member: mockPushMember })),
}))
// Serialisation is covered by serializeMemberForAPI.test.ts; here the route
// only has to hand it the use case's result.
jest.mock('@/features/members/utils/serializeMemberForAPI', () => ({
  serializeMemberForAPI: jest.fn((m: { id: string }) => ({ id: m.id })),
}))

import { PATCH } from '../[id]/route'
import { getApiGymProfile } from '@/lib/middleware/api-auth'

const GYM_ID = 'gym-from-session'
const MEMBER_ID = 'member-from-path'

function call(body: unknown) {
  const request = new NextRequest(`http://localhost/api/members/${MEMBER_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return PATCH(request, { params: Promise.resolve({ id: MEMBER_ID }) })
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
  ;(getApiGymProfile as jest.Mock).mockResolvedValue({
    gymProfile: { id: GYM_ID },
    error: null,
  })
  mockExecute.mockResolvedValue({ id: MEMBER_ID })
  mockPushMember.mockResolvedValue({ applicable: false, pushed: false })
})

describe('PATCH /api/members/[id]', () => {
  it('passes the validated edit to the use case with member and gym from the path and session', async () => {
    const res = await call({
      name: 'Fathima H. Herath',
      phoneNumber: '0771234567',
      planType: 'annual',
      planAmount: 30000,
      discountId: null,
      recurringDiscount: false,
    })

    expect(res.status).toBe(200)
    expect(mockExecute).toHaveBeenCalledWith({
      name: 'Fathima H. Herath',
      // Normalised by the schema, so the use case compares like with like.
      phoneNumber: '+94771234567',
      planType: 'annual',
      planAmount: 30000,
      discountId: null,
      recurringDiscount: false,
      memberId: MEMBER_ID,
      gymId: GYM_ID,
    })
  })

  it('cannot be pointed at another gym or member from the body', async () => {
    await call({
      name: 'Some Name',
      gymId: 'other-gym',
      memberId: 'other-member',
    })

    const input = mockExecute.mock.calls[0][0]
    expect(input.gymId).toBe(GYM_ID)
    expect(input.memberId).toBe(MEMBER_ID)
  })

  it('reports a phone number another member holds as 409 with the reason', async () => {
    mockExecute.mockRejectedValue(
      new ConflictError(
        'A member with phone number (077) 123-4567 already exists'
      )
    )

    const res = await call({ phoneNumber: '0771234567' })
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('CONFLICT')
    expect(body.error.message).toBe(
      'A member with phone number (077) 123-4567 already exists'
    )
  })

  it('reports a missing member as 404 with a readable message', async () => {
    mockExecute.mockRejectedValue(new NotFoundError('Member x'))

    const res = await call({ name: 'Some Name' })
    const body = await res.json()

    expect(res.status).toBe(404)
    // Not "Member not found not found": notFound() appends its own suffix.
    expect(body.error.message).toBe('Member not found')
  })

  it('reports a domain validation failure as 400', async () => {
    mockExecute.mockRejectedValue(
      ValidationError.fromField('phoneNumber', 'bad')
    )

    const res = await call({ name: 'Some Name' })

    expect(res.status).toBe(400)
  })

  it('rejects an invalid body as 400 without calling the use case', async () => {
    const res = await call({ name: 'a' })

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR')
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('rejects an unauthenticated caller before doing anything', async () => {
    ;(getApiGymProfile as jest.Mock).mockResolvedValue({
      gymProfile: null,
      error: NextResponse.json({ success: false }, { status: 401 }),
    })

    const res = await call({ name: 'Some Name' })

    expect(res.status).toBe(401)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('pushes a rename to the reader only when the name was part of the edit', async () => {
    await call({ planAmount: 4000 })
    expect(mockPushMember).not.toHaveBeenCalled()

    await call({ name: 'Renamed Person' })
    expect(mockPushMember).toHaveBeenCalledWith(GYM_ID, MEMBER_ID)
  })

  it('still succeeds when the rename does not reach the vendor', async () => {
    mockPushMember.mockRejectedValue(new Error('vendor down'))

    const res = await call({ name: 'Renamed Person' })

    expect(res.status).toBe(200)
  })

  it('reports an unexpected failure as 500 without leaking the cause', async () => {
    mockExecute.mockRejectedValue(
      new Error('relation "members" does not exist')
    )

    const res = await call({ name: 'Some Name' })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(JSON.stringify(body)).not.toContain('relation')
  })
})
