/**
 * Auto-cancellation of long-overdue members.
 *
 * Business rule: an EXPIRED member whose next_due_date is
 * MEMBER_CANCELLATION_OVERDUE_DAYS (14) or more days in the past is flipped to
 * Cancelled by the daily cancel-overdue-members cron. The boundary is
 * inclusive — exactly 14 days overdue cancels.
 */

import { CancelOverdueMembers } from '@/features/members/services/CancelOverdueMembers'
import { Member } from '@/features/members/domain/Member'
import {
  MemberStatus,
  MEMBER_CANCELLATION_OVERDUE_DAYS,
} from '@/features/members/config/StatusConfig'
import { PlanType } from '@/features/members/config/PlanConfig'
import type { IMemberRepository } from '../services/IMemberRepository'

const GYM_ID = 'gym-1'

function daysAgo(days: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - days)
  return d
}

function makeMember(
  status: MemberStatus,
  nextDueDate: Date,
  name: string
): Member {
  return Member.fromDatabase({
    id: `member-${name.replace(/\s+/g, '-').toLowerCase()}`,
    gymId: GYM_ID,
    name,
    phoneNumber: '+94771234567',
    planType: PlanType.Monthly,
    planAmount: 2000,
    discountId: null,
    recurringDiscount: false,
    status,
    registeredDate: new Date('2026-01-01'),
    membershipStartDate: new Date('2026-01-01'),
    nextDueDate,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  })
}

function mockMemberRepo(expired: Member[]) {
  return {
    findAllExpiredMembers: jest.fn().mockResolvedValue(expired),
    update: jest.fn(async (m: Member) => m),
  } as unknown as jest.Mocked<IMemberRepository>
}

describe('CancelOverdueMembers — 14-day cancellation threshold', () => {
  it('cancels a member exactly at the threshold (14 days overdue)', async () => {
    const memberRepo = mockMemberRepo([
      makeMember(
        MemberStatus.Expired,
        daysAgo(MEMBER_CANCELLATION_OVERDUE_DAYS),
        'Exactly Fourteen'
      ),
    ])

    const summary = await new CancelOverdueMembers(memberRepo).execute()

    expect(summary.totalCancelled).toBe(1)
    expect(memberRepo.update).toHaveBeenCalledTimes(1)
    const persisted = memberRepo.update.mock.calls[0][0]
    expect(persisted.status).toBe(MemberStatus.Cancelled)
    expect(summary.cancelledMembers[0].daysOverdue).toBe(
      MEMBER_CANCELLATION_OVERDUE_DAYS
    )
  })

  it('cancels members well past the threshold', async () => {
    const memberRepo = mockMemberRepo([
      makeMember(MemberStatus.Expired, daysAgo(30), 'Thirty Days'),
      makeMember(MemberStatus.Expired, daysAgo(90), 'Ninety Days'),
    ])

    const summary = await new CancelOverdueMembers(memberRepo).execute()

    expect(summary.totalCancelled).toBe(2)
    expect(memberRepo.update).toHaveBeenCalledTimes(2)
  })

  it('does NOT cancel a member one day short of the threshold (13 days overdue)', async () => {
    const memberRepo = mockMemberRepo([
      makeMember(
        MemberStatus.Expired,
        daysAgo(MEMBER_CANCELLATION_OVERDUE_DAYS - 1),
        'Thirteen Days'
      ),
    ])

    const summary = await new CancelOverdueMembers(memberRepo).execute()

    expect(summary.totalCancelled).toBe(0)
    expect(memberRepo.update).not.toHaveBeenCalled()
  })

  it('cancels members the old 45-day rule would have left expired', async () => {
    const memberRepo = mockMemberRepo([
      makeMember(MemberStatus.Expired, daysAgo(20), 'Twenty Days'),
      makeMember(MemberStatus.Expired, daysAgo(44), 'Forty Four Days'),
    ])

    const summary = await new CancelOverdueMembers(memberRepo).execute()

    expect(summary.totalCancelled).toBe(2)
  })

  it('honours an explicit overdueDays override', async () => {
    const memberRepo = mockMemberRepo([
      makeMember(MemberStatus.Expired, daysAgo(20), 'Twenty Days'),
    ])

    const summary = await new CancelOverdueMembers(memberRepo).execute({
      overdueDays: 30,
    })

    expect(summary.totalCancelled).toBe(0)
  })

  it('records an error and keeps going when one member fails to persist', async () => {
    const memberRepo = mockMemberRepo([
      makeMember(MemberStatus.Expired, daysAgo(20), 'Broken One'),
      makeMember(MemberStatus.Expired, daysAgo(20), 'Healthy One'),
    ])
    ;(memberRepo.update as jest.Mock)
      .mockRejectedValueOnce(new Error('db down'))
      .mockImplementationOnce(async (m: Member) => m)

    const summary = await new CancelOverdueMembers(memberRepo).execute()

    expect(summary.totalCancelled).toBe(1)
    expect(summary.errors).toHaveLength(1)
    expect(summary.errors[0]).toContain('Broken One')
  })

  it('ignores members that are not overdue at all', async () => {
    const memberRepo = mockMemberRepo([
      makeMember(MemberStatus.Expired, daysAgo(-5), 'Not Due Yet'),
    ])

    const summary = await new CancelOverdueMembers(memberRepo).execute()

    expect(summary.totalCancelled).toBe(0)
  })
})
