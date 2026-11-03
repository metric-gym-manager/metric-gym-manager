/**
 * Update Member Profile Use Case Tests
 *
 * `PATCH /api/members/[id]` used to read a member, apply the edit in memory and
 * write the WHOLE row back, and it never looked at the phone number. Two
 * defects came from that:
 *
 * - Editing a phone onto another member's number succeeded. Registration
 *   refuses the same thing (`RegisterMember` step 2); the edit path did not.
 * - Every column was rewritten from the earlier read, so a payment collected
 *   between the read and the write was silently reverted.
 *
 * These pin the use case, with the repository mocked; what the repository
 * actually writes is pinned in `SupabaseMemberRepositoryUpdateProfile.test.ts`.
 */

import { UpdateMemberProfile } from '../services/UpdateMemberProfile'
import { Member } from '@/features/members/domain/Member'
import { PlanType } from '@/features/members/config/PlanConfig'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { createMemberStore } from '@/test-utils/memberStore'
import { ConflictError, NotFoundError } from '@/utils/errors'

const GYM_ID = 'gym-1'
const OWN_PHONE = '+94751230428'
const OTHER_PHONE = '+94771234567'

function memberFixture(overrides: Partial<{ id: string; phone: string }> = {}) {
  return Member.fromDatabase({
    id: overrides.id ?? 'member-1',
    gymId: GYM_ID,
    memberNumber: 7,
    name: 'Fathima Herath',
    phoneNumber: overrides.phone ?? OWN_PHONE,
    planType: PlanType.Monthly,
    planAmount: 3500,
    discountId: null,
    recurringDiscount: false,
    status: MemberStatus.Active,
    registeredDate: new Date('2026-08-16'),
    membershipStartDate: new Date('2026-08-16'),
    nextDueDate: new Date('2026-12-16'),
    createdAt: new Date('2026-08-16T00:00:00Z'),
    updatedAt: new Date('2026-08-16T00:00:00Z'),
  })
}

describe('UpdateMemberProfile', () => {
  let repo: {
    findById: jest.Mock
    findByPhoneNumber: jest.Mock
    updateFields: jest.Mock
  }
  let useCase: UpdateMemberProfile

  beforeEach(() => {
    repo = {
      findById: jest.fn().mockResolvedValue(memberFixture()),
      findByPhoneNumber: jest.fn().mockResolvedValue(null),
      updateFields: jest.fn(async (m: Member) => m),
    }
    useCase = new UpdateMemberProfile(repo as never)
  })

  describe('what is written', () => {
    it('applies every supplied field through the profile-only write', async () => {
      const saved = await useCase.execute({
        memberId: 'member-1',
        gymId: GYM_ID,
        name: 'Fathima H. Herath',
        planType: PlanType.Annual,
        planAmount: 30000,
        discountId: 'discount-1',
        recurringDiscount: true,
      })

      expect(repo.updateFields).toHaveBeenCalledTimes(1)
      // Named fields only: a profile edit never writes status or the due date.
      expect(repo.updateFields).toHaveBeenCalledWith(expect.anything(), [
        'name',
        'planType',
        'planAmount',
        'discountId',
        'recurringDiscount',
      ])
      expect(saved.name).toBe('Fathima H. Herath')
      expect(saved.planType).toBe(PlanType.Annual)
      expect(saved.planAmount).toBe(30000)
      expect(saved.discountId).toBe('discount-1')
      expect(saved.recurringDiscount).toBe(true)
    })

    it('writes only the fields it was given', async () => {
      await useCase.execute({
        memberId: 'member-1',
        gymId: GYM_ID,
        planAmount: 4200,
      })

      expect(repo.updateFields).toHaveBeenCalledWith(expect.anything(), [
        'planAmount',
      ])
    })

    it('writes nothing, and returns the member, when it was given no fields', async () => {
      const saved = await useCase.execute({
        memberId: 'member-1',
        gymId: GYM_ID,
      })

      expect(repo.updateFields).not.toHaveBeenCalled()
      expect(saved.id).toBe('member-1')
    })

    it('counts an explicit null discount as supplied', async () => {
      await useCase.execute({
        memberId: 'member-1',
        gymId: GYM_ID,
        discountId: null,
      })

      expect(repo.updateFields).toHaveBeenCalledWith(expect.anything(), [
        'discountId',
      ])
    })

    it('clears the discount when null is supplied', async () => {
      repo.findById.mockResolvedValue(
        Member.fromDatabase({
          ...memberFixture().toDatabase(),
          discountId: 'discount-1',
        })
      )

      const saved = await useCase.execute({
        memberId: 'member-1',
        gymId: GYM_ID,
        discountId: null,
      })

      expect(saved.discountId).toBeNull()
    })

    it('leaves unsupplied fields as they were', async () => {
      const saved = await useCase.execute({
        memberId: 'member-1',
        gymId: GYM_ID,
        name: 'Only The Name',
      })

      expect(saved.phoneNumber).toBe(OWN_PHONE)
      expect(saved.planAmount).toBe(3500)
      expect(saved.planType).toBe(PlanType.Monthly)
    })
  })

  describe('phone number uniqueness', () => {
    it('saves a new phone that nobody else uses', async () => {
      const saved = await useCase.execute({
        memberId: 'member-1',
        gymId: GYM_ID,
        phoneNumber: OTHER_PHONE,
      })

      expect(repo.findByPhoneNumber).toHaveBeenCalledWith(OTHER_PHONE, GYM_ID)
      expect(saved.phoneNumber).toBe(OTHER_PHONE)
    })

    it('refuses a phone that belongs to another member', async () => {
      repo.findByPhoneNumber.mockResolvedValue(
        memberFixture({ id: 'someone-else', phone: OTHER_PHONE })
      )

      await expect(
        useCase.execute({
          memberId: 'member-1',
          gymId: GYM_ID,
          phoneNumber: OTHER_PHONE,
        })
      ).rejects.toBeInstanceOf(ConflictError)
      expect(repo.updateFields).not.toHaveBeenCalled()
    })

    it('names the number in the refusal, in the same display form as registration', async () => {
      repo.findByPhoneNumber.mockResolvedValue(
        memberFixture({ id: 'someone-else', phone: OTHER_PHONE })
      )

      await expect(
        useCase.execute({
          memberId: 'member-1',
          gymId: GYM_ID,
          phoneNumber: OTHER_PHONE,
        })
      ).rejects.toThrow('(077) 123-4567')
    })

    it('does not look the phone up when it has not changed', async () => {
      // The edit form always resends the phone. A member whose number is
      // already duplicated (it was possible before this check existed) must
      // still be editable, so an unchanged number is not re-validated.
      await useCase.execute({
        memberId: 'member-1',
        gymId: GYM_ID,
        name: 'New Name',
        phoneNumber: OWN_PHONE,
      })

      expect(repo.findByPhoneNumber).not.toHaveBeenCalled()
      expect(repo.updateFields).toHaveBeenCalledTimes(1)
    })

    it('does not look the phone up when none is supplied', async () => {
      await useCase.execute({
        memberId: 'member-1',
        gymId: GYM_ID,
        planAmount: 4000,
      })

      expect(repo.findByPhoneNumber).not.toHaveBeenCalled()
    })

    it('ignores a match that is the member itself', async () => {
      // Defensive: a lookup that returns the row being edited is not a clash.
      repo.findByPhoneNumber.mockResolvedValue(
        memberFixture({ id: 'member-1', phone: OTHER_PHONE })
      )

      await expect(
        useCase.execute({
          memberId: 'member-1',
          gymId: GYM_ID,
          phoneNumber: OTHER_PHONE,
        })
      ).resolves.toBeDefined()
    })
  })

  describe('missing member', () => {
    it('throws NotFoundError and writes nothing', async () => {
      repo.findById.mockResolvedValue(null)

      await expect(
        useCase.execute({ memberId: 'ghost', gymId: GYM_ID, name: 'X Y' })
      ).rejects.toBeInstanceOf(NotFoundError)
      expect(repo.updateFields).not.toHaveBeenCalled()
    })
  })

  describe('tenant scoping', () => {
    it("reads the member and checks the phone inside the caller's gym", async () => {
      await useCase.execute({
        memberId: 'member-1',
        gymId: GYM_ID,
        phoneNumber: OTHER_PHONE,
      })

      expect(repo.findById).toHaveBeenCalledWith('member-1', GYM_ID)
      expect(repo.findByPhoneNumber).toHaveBeenCalledWith(OTHER_PHONE, GYM_ID)
    })
  })
})

describe('UpdateMemberProfile — two edits to different fields', () => {
  // A second desk device that never touched the phone must not rewrite it with
  // the copy it read before the first device changed it.
  it('keeps a field changed by another edit that landed after this one read', async () => {
    const store = createMemberStore(memberFixture())
    store.duringNextRead(async () => {
      await new UpdateMemberProfile(store.repo as never).execute({
        memberId: 'member-1',
        gymId: GYM_ID,
        phoneNumber: OTHER_PHONE,
      })
    })

    await new UpdateMemberProfile(store.repo as never).execute({
      memberId: 'member-1',
      gymId: GYM_ID,
      planAmount: 4200,
    })

    expect(store.current.phoneNumber).toBe(OTHER_PHONE)
    expect(store.current.planAmount).toBe(4200)
  })
})
