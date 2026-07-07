import { SendAutomatedReminders } from '@/core/use-cases/reminder/SendAutomatedReminders';
import { Member } from '@/core/domain/member/Member';
import { MemberStatus } from '@/core/utils/constants/StatusConfig';
import { PlanType } from '@/core/utils/constants/PlanConfig';
import { SaasTier, SaasStatus } from '@/core/utils/constants/SubscriptionConfig';
import { makeSubscription, mockSubscriptionRepo } from '@/core/test-utils/subscription-mocks';
import type { IMemberRepository } from '@/core/ports/repositories/IMemberRepository';
import type { ISMSRepository } from '@/core/ports/repositories/ISMSRepository';
import type { ISMSProvider } from '@/core/ports/services/ISMSProvider';

function makeMember(gymId: string, name: string): Member {
  return Member.create({
    gymId,
    name,
    phoneNumber: '+94771234567',
    planType: PlanType.Monthly,
    planAmount: 2000,
    discountId: null,
    recurringDiscount: false,
    status: MemberStatus.Active,
    registeredDate: new Date('2026-01-01'),
    membershipStartDate: new Date('2026-01-01'),
    // Yesterday -> deterministic Overdue reminder for monthly plans
    nextDueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
  });
}

describe('SendAutomatedReminders — Starter plan restriction (PlanRestrictions)', () => {
  const starterGym = 'gym-starter';
  const growthGym = 'gym-growth';

  function build(members: Member[]) {
    const memberRepo = {
      findAllActiveMembers: jest.fn().mockResolvedValue(members),
      findActiveMembers: jest.fn(
        async (gymId: string) => members.filter((m) => m.gymId === gymId)
      ),
    } as unknown as jest.Mocked<IMemberRepository>;

    const smsRepo = {
      existsForToday: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockResolvedValue({ id: 'log-1' }),
    } as unknown as jest.Mocked<ISMSRepository>;

    const smsProvider = {
      send: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-1' }),
    } as unknown as jest.Mocked<ISMSProvider>;

    const subscriptionRepo = mockSubscriptionRepo();
    subscriptionRepo.findByGymId.mockImplementation(async (gymId: string) =>
      makeSubscription({
        gymId,
        tier: gymId === growthGym ? SaasTier.Growth : SaasTier.Starter,
        status: SaasStatus.Active,
      })
    );

    const useCase = new SendAutomatedReminders(memberRepo, smsRepo, smsProvider, subscriptionRepo);
    return { useCase, memberRepo, smsRepo, smsProvider, subscriptionRepo };
  }

  it('skips members of Starter gyms and counts them as plan-restricted', async () => {
    const { useCase, smsProvider } = build([
      makeMember(starterGym, 'Starter Member'),
      makeMember(growthGym, 'Growth Member'),
    ]);

    const summary = await useCase.execute();

    expect(summary.membersSkippedPlanRestricted).toBe(1);
    // Only the growth gym's member ever reaches the SMS provider
    expect(smsProvider.send).toHaveBeenCalledTimes(1);
  });

  it('resolves each distinct gym tier once, not per member', async () => {
    const { useCase, subscriptionRepo } = build([
      makeMember(growthGym, 'Member A'),
      makeMember(growthGym, 'Member B'),
      makeMember(starterGym, 'Member C'),
    ]);

    await useCase.execute();

    expect(subscriptionRepo.findByGymId).toHaveBeenCalledTimes(2);
  });

  it('fails closed: a gym with no resolvable subscription row is treated as restricted', async () => {
    const { useCase, subscriptionRepo, smsProvider } = build([makeMember(starterGym, 'Member X')]);
    subscriptionRepo.findByGymId.mockResolvedValue(null);

    const summary = await useCase.execute();

    expect(summary.membersSkippedPlanRestricted).toBe(1);
    expect(smsProvider.send).not.toHaveBeenCalled();
  });

  it('single-gym run (gymId input) is skipped entirely for a Starter gym', async () => {
    const { useCase, smsProvider } = build([makeMember(starterGym, 'Member Y')]);

    const summary = await useCase.execute({ gymId: starterGym });

    expect(summary.membersSkippedPlanRestricted).toBe(1);
    expect(summary.totalSent).toBe(0);
    expect(smsProvider.send).not.toHaveBeenCalled();
  });
});
