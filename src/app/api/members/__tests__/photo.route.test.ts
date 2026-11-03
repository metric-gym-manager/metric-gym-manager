/**
 * @jest-environment node
 */

/**
 * POST / DELETE /api/members/[id]/photo
 *
 * Saving a photo reads the member, asks R2 whether the object landed (a network
 * round trip), then writes. That gap is the widest of any manual member write,
 * and the write used to carry the whole member row: a profile edit made while
 * R2 was answering was put back. The write now names the two photo columns.
 */

import { NextRequest } from 'next/server'
import { Member } from '@/features/members/domain/Member'
import { PlanType } from '@/features/members/config/PlanConfig'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { PHOTO_FIELDS } from '@/features/members/config/MemberWriteFields'
import { UpdateMemberProfile } from '@/features/members/services/UpdateMemberProfile'
import { createMemberStore } from '@/test-utils/memberStore'

const MEMBER_ID = 'member-1'
const GYM_ID = 'gym-1'

const stored = Member.fromDatabase({
  id: MEMBER_ID,
  gymId: GYM_ID,
  memberNumber: 7,
  name: 'Fathima Herath',
  phoneNumber: '+94770000001',
  planType: PlanType.Monthly,
  planAmount: 3500,
  discountId: null,
  recurringDiscount: false,
  status: MemberStatus.Active,
  registeredDate: new Date('2026-01-01'),
  membershipStartDate: new Date('2026-01-01'),
  nextDueDate: new Date('2026-12-01'),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  photoPath: 'profiles/member-1.jpg',
  photoUpdatedAt: new Date('2026-02-01T00:00:00Z'),
})

const store = createMemberStore(stored)
const storage = {
  exists: jest.fn(async () => true),
  delete: jest.fn(async () => undefined),
}

jest.mock('@/lib/middleware/auth', () => ({
  getCurrentGymProfile: jest.fn(async () => ({ id: 'gym-1' })),
}))
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({})),
}))
jest.mock('@/lib/storage/factory', () => ({
  createStorageProvider: jest.fn(() => storage),
}))
jest.mock('@/features/members', () => ({
  createMemberRepository: jest.fn(() => store.repo),
}))

import { POST, DELETE } from '../[id]/photo/route'

const context = { params: Promise.resolve({ id: MEMBER_ID }) }

const post = (path: string) =>
  POST(
    new NextRequest(`http://localhost/api/members/${MEMBER_ID}/photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    }),
    context
  )

const remove = () =>
  DELETE(
    new NextRequest(`http://localhost/api/members/${MEMBER_ID}/photo`, {
      method: 'DELETE',
    }),
    context
  )

beforeEach(() => {
  jest.clearAllMocks()
  storage.exists.mockResolvedValue(true)
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('member photo route — which columns are written', () => {
  it('saving a photo writes the photo columns only', async () => {
    const res = await post(`profiles/${MEMBER_ID}.webp`)

    expect(res.status).toBe(200)
    expect(store.repo.updateFields.mock.calls[0][1]).toEqual(PHOTO_FIELDS)
  })

  it('removing a photo writes the photo columns only', async () => {
    const res = await remove()

    expect(res.status).toBe(200)
    expect(store.repo.updateFields.mock.calls[0][1]).toEqual(PHOTO_FIELDS)
  })
})

describe('member photo route — racing a profile edit', () => {
  it('a photo saved while the member is edited keeps the edit', async () => {
    // The edit lands while the route is asking R2 whether the upload exists.
    storage.exists.mockImplementationOnce(async () => {
      await new UpdateMemberProfile(store.repo as never).execute({
        memberId: MEMBER_ID,
        gymId: GYM_ID,
        name: 'Fathima Perera',
        phoneNumber: '+94771234567',
      })
      return true
    })

    const res = await post(`profiles/${MEMBER_ID}.webp`)

    expect(res.status).toBe(200)
    expect(store.get(MEMBER_ID).photoPath).toBe(`profiles/${MEMBER_ID}.webp`)
    expect(store.get(MEMBER_ID).name).toBe('Fathima Perera')
    expect(store.get(MEMBER_ID).phoneNumber).toBe('+94771234567')
  })
})
