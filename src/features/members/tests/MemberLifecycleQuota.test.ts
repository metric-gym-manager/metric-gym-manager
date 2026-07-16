/**
 * Active-member quota lifecycle — use-case level.
 *
 * Covers the app-layer half of migration 20260708000001:
 *  - UpdateExpiredStatus: unpaid actives expire only after
 *    MEMBER_EXPIRY_GRACE_DAYS (7) full days past next_due_date
 *  - CollectPayment: the member flip runs BEFORE the payment insert, so a
 *    quota block (MemberLimitError from the DB trigger) records nothing
 *  - ReactivateMember: propagates MemberLimitError untouched (the route maps
 *    it to 403 MEMBER_LIMIT_REACHED)
 */

import { UpdateExpiredStatus } from '@/features/members/services/UpdateExpiredStatus';
import { ReactivateMember } from '@/features/members/services/ReactivateMember';
import { CollectPayment } from '@/features/payments/services/CollectPayment';
import { Member } from '@/features/members/domain/Member';
import { MemberStatus, MEMBER_EXPIRY_GRACE_DAYS } from '@/features/members/config/StatusConfig';
import { PlanType } from '@/features/members/config/PlanConfig';
import { MemberLimitError } from '@/utils/errors';
import type { IMemberRepository } from '../services/IMemberRepository';
import type { IPaymentRepository } from '@/features/payments/services/IPaymentRepository';
import type { ISMSRepository } from '@/features/sms/services/ISMSRepository';
import type { ISMSProvider } from '@/features/sms/services/ISMSProvider';

const GYM_ID = 'gym-1';

function daysAgo(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

function makeMember(status: MemberStatus, nextDueDate: Date, name = 'Test Member'): Member {
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
  });
}

function mockMemberRepo(overrides: Partial<jest.Mocked<IMemberRepository>> = {}) {
  return {
    findAllActiveMembers: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    update: jest.fn(async (m: Member) => m),
    ...overrides,
  } as unknown as jest.Mocked<IMemberRepository>;
}

describe('UpdateExpiredStatus — 7-day unpaid grace before expiry', () => {
  it('does NOT expire a member inside the grace window (6 days overdue)', async () => {
    const memberRepo = mockMemberRepo({
      findAllActiveMembers: jest
        .fn()
        .mockResolvedValue([makeMember(MemberStatus.Active, daysAgo(MEMBER_EXPIRY_GRACE_DAYS - 1))]),
    } as Partial<jest.Mocked<IMemberRepository>>);

    const summary = await new UpdateExpiredStatus(memberRepo).execute();

    expect(summary.totalUpdated).toBe(0);
    expect(memberRepo.update).not.toHaveBeenCalled();
  });

  it('expires a member exactly at the grace boundary (7 days overdue)', async () => {
    const memberRepo = mockMemberRepo({
      findAllActiveMembers: jest
        .fn()
        .mockResolvedValue([makeMember(MemberStatus.Active, daysAgo(MEMBER_EXPIRY_GRACE_DAYS))]),
    } as Partial<jest.Mocked<IMemberRepository>>);

    const summary = await new UpdateExpiredStatus(memberRepo).execute();

    expect(summary.totalUpdated).toBe(1);
    expect(memberRepo.update).toHaveBeenCalledTimes(1);
    const persisted = memberRepo.update.mock.calls[0][0];
    expect(persisted.status).toBe(MemberStatus.Expired);
  });

  it('does NOT expire members who are not yet due', async () => {
    const memberRepo = mockMemberRepo({
      findAllActiveMembers: jest
        .fn()
        .mockResolvedValue([makeMember(MemberStatus.Active, daysAgo(-10))]),
    } as Partial<jest.Mocked<IMemberRepository>>);

    const summary = await new UpdateExpiredStatus(memberRepo).execute();

    expect(summary.totalUpdated).toBe(0);
  });
});

describe('ReactivateMember — active-member quota', () => {
  it('propagates MemberLimitError from the repository (DB trigger gate)', async () => {
    const expired = makeMember(MemberStatus.Expired, daysAgo(30));
    const memberRepo = mockMemberRepo({
      findById: jest.fn().mockResolvedValue(expired),
      update: jest.fn().mockRejectedValue(new MemberLimitError()),
    } as Partial<jest.Mocked<IMemberRepository>>);

    await expect(
      new ReactivateMember(memberRepo).execute({
        memberId: expired.id,
        gymId: GYM_ID,
        newDueDate: daysAgo(-30),
      })
    ).rejects.toThrow(MemberLimitError);
  });
});

describe('CollectPayment — quota block records nothing', () => {
  function build(member: Member, updateImpl?: jest.Mock) {
    const memberRepo = mockMemberRepo({
      findById: jest.fn().mockResolvedValue(member),
      ...(updateImpl ? { update: updateImpl } : {}),
    } as Partial<jest.Mocked<IMemberRepository>>);

    const paymentRepo = {
      create: jest.fn(async (p: unknown) => p),
    } as unknown as jest.Mocked<IPaymentRepository>;

    const smsProvider = {
      send: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-1' }),
    } as unknown as jest.Mocked<ISMSProvider>;

    const smsRepo = {
      create: jest.fn().mockResolvedValue({ id: 'log-1' }),
    } as unknown as jest.Mocked<ISMSRepository>;

    const useCase = new CollectPayment(memberRepo, paymentRepo, smsProvider, smsRepo);
    return { useCase, memberRepo, paymentRepo };
  }

  it('rejects with MemberLimitError and never creates the payment when reactivation is quota-blocked', async () => {
    const expired = makeMember(MemberStatus.Expired, daysAgo(30));
    const { useCase, paymentRepo } = build(
      expired,
      jest.fn().mockRejectedValue(new MemberLimitError())
    );

    await expect(
      useCase.execute({
        gymId: GYM_ID,
        memberId: expired.id,
        paymentDate: new Date(),
        paymentAmount: 2000,
      })
    ).rejects.toThrow(MemberLimitError);

    // ORDER MATTERS contract: quota fails before any payment write
    expect(paymentRepo.create).not.toHaveBeenCalled();
  });

  it('flips the member BEFORE creating the payment on success', async () => {
    const calls: string[] = [];
    const expired = makeMember(MemberStatus.Expired, daysAgo(30));

    const memberRepo = mockMemberRepo({
      findById: jest.fn().mockResolvedValue(expired),
      update: jest.fn(async (m: Member) => {
        calls.push('member.update');
        return m;
      }),
    } as Partial<jest.Mocked<IMemberRepository>>);
    const paymentRepo = {
      create: jest.fn(async (p: unknown) => {
        calls.push('payment.create');
        return p;
      }),
    } as unknown as jest.Mocked<IPaymentRepository>;
    const smsProvider = {
      send: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-1' }),
    } as unknown as jest.Mocked<ISMSProvider>;
    const smsRepo = {
      create: jest.fn().mockResolvedValue({ id: 'log-1' }),
    } as unknown as jest.Mocked<ISMSRepository>;

    const result = await new CollectPayment(memberRepo, paymentRepo, smsProvider, smsRepo).execute({
      gymId: GYM_ID,
      memberId: expired.id,
      paymentDate: new Date(),
      paymentAmount: 2000,
    });

    expect(result.member.status).toBe(MemberStatus.Active);
    expect(calls).toEqual(['member.update', 'payment.create']);
  });
});
