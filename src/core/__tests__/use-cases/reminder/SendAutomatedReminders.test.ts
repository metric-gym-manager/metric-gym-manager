import { SendAutomatedReminders } from '@/core/use-cases/reminder/SendAutomatedReminders';
import { Member } from '@/core/domain/member/Member';
import { MemberStatus } from '@/core/utils/constants/StatusConfig';
import { PlanType } from '@/core/utils/constants/PlanConfig';
import { SaasTier, SaasStatus } from '@/core/utils/constants/SubscriptionConfig';
import { makeSubscription, mockSubscriptionRepo } from '@/core/test-utils/subscription-mocks';
import type { IMemberRepository } from '@/core/ports/repositories/IMemberRepository';
import type { ISMSRepository } from '@/core/ports/repositories/ISMSRepository';
import type { ISMSProvider } from '@/core/ports/services/ISMSProvider';
import type { Subscription } from '@/core/domain/subscription/Subscription';

function daysFromToday(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function makeMember(
  gymId: string,
  name: string,
  overrides: Partial<Parameters<typeof Member.create>[0]> = {}
): Member {
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
    ...overrides,
  });
}

describe('SendAutomatedReminders — billing-status gate (reminders on every tier)', () => {
  function build(
    members: Member[],
    subs: Record<string, Subscription>,
    expiredMembers: Member[] = []
  ) {
    const memberRepo = {
      findAllActiveMembers: jest.fn().mockResolvedValue(members),
      findActiveMembers: jest.fn(
        async (gymId: string) => members.filter((m) => m.gymId === gymId)
      ),
      findAllExpiredMembers: jest.fn().mockResolvedValue(expiredMembers),
      findExpiredMembers: jest.fn(
        async (gymId: string) => expiredMembers.filter((m) => m.gymId === gymId)
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
    subscriptionRepo.findByGymId.mockImplementation(async (gymId: string) => subs[gymId] ?? null);

    const useCase = new SendAutomatedReminders(memberRepo, smsRepo, smsProvider, subscriptionRepo);
    return { useCase, memberRepo, smsRepo, smsProvider, subscriptionRepo };
  }

  it('sends for every tier — Lite, Pro and Enterprise members all get reminders', async () => {
    const { useCase, smsProvider } = build(
      [
        makeMember('gym-lite', 'Lite Member'),
        makeMember('gym-pro', 'Pro Member'),
        makeMember('gym-ent', 'Enterprise Member'),
      ],
      {
        'gym-lite': makeSubscription({ gymId: 'gym-lite', tier: SaasTier.Lite }),
        'gym-pro': makeSubscription({ gymId: 'gym-pro', tier: SaasTier.Pro }),
        'gym-ent': makeSubscription({ gymId: 'gym-ent', tier: SaasTier.Enterprise }),
      }
    );

    const summary = await useCase.execute();

    expect(summary.membersSkippedBillingRestricted).toBe(0);
    expect(smsProvider.send).toHaveBeenCalledTimes(3);
  });

  it('sends while trialing (full features during the trial window)', async () => {
    const { useCase, smsProvider } = build([makeMember('gym-t', 'Trial Member')], {
      'gym-t': makeSubscription({ gymId: 'gym-t', status: SaasStatus.Trialing }),
    });

    const summary = await useCase.execute();

    expect(summary.membersSkippedBillingRestricted).toBe(0);
    expect(smsProvider.send).toHaveBeenCalledTimes(1);
  });

  it('sends for canceled while paid-through; halts once the period lapses and for suspended', async () => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const { useCase, smsProvider } = build(
      [
        makeMember('gym-paid', 'Canceled Paid-Through Member'),
        makeMember('gym-lapsed', 'Canceled Lapsed Member'),
        makeMember('gym-s', 'Suspended Member'),
      ],
      {
        // Canceled but the paid period still covers today -> reminders flow
        'gym-paid': makeSubscription({
          gymId: 'gym-paid',
          tier: SaasTier.Enterprise,
          status: SaasStatus.Canceled,
          currentPeriodEnd: new Date(now + 5 * dayMs),
        }),
        // Canceled and the period has ended -> halted (dunning suspends next)
        'gym-lapsed': makeSubscription({
          gymId: 'gym-lapsed',
          tier: SaasTier.Enterprise,
          status: SaasStatus.Canceled,
          currentPeriodEnd: new Date(now - 1 * dayMs),
        }),
        'gym-s': makeSubscription({
          gymId: 'gym-s',
          tier: SaasTier.Pro,
          status: SaasStatus.Suspended,
        }),
      }
    );

    const summary = await useCase.execute();

    expect(summary.membersSkippedBillingRestricted).toBe(2);
    expect(smsProvider.send).toHaveBeenCalledTimes(1);
  });

  it('sends for past_due within grace; halts past grace', async () => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const { useCase, smsProvider } = build(
      [makeMember('gym-grace', 'In Grace'), makeMember('gym-lapsed', 'Past Grace')],
      {
        'gym-grace': makeSubscription({
          gymId: 'gym-grace',
          tier: SaasTier.Lite,
          status: SaasStatus.PastDue,
          currentPeriodEnd: new Date(now - 2 * dayMs), // 2 days past due, inside 7-day grace
        }),
        'gym-lapsed': makeSubscription({
          gymId: 'gym-lapsed',
          tier: SaasTier.Lite,
          status: SaasStatus.PastDue,
          currentPeriodEnd: new Date(now - 30 * dayMs), // far past grace
        }),
      }
    );

    const summary = await useCase.execute();

    expect(summary.membersSkippedBillingRestricted).toBe(1);
    expect(smsProvider.send).toHaveBeenCalledTimes(1);
  });

  it('resolves each distinct gym once, not per member', async () => {
    const { useCase, subscriptionRepo } = build(
      [makeMember('gym-a', 'Member A'), makeMember('gym-a', 'Member B'), makeMember('gym-b', 'Member C')],
      {
        'gym-a': makeSubscription({ gymId: 'gym-a' }),
        'gym-b': makeSubscription({ gymId: 'gym-b' }),
      }
    );

    await useCase.execute();

    expect(subscriptionRepo.findByGymId).toHaveBeenCalledTimes(2);
  });

  it('fails closed: a gym with no resolvable subscription row is treated as restricted', async () => {
    const { useCase, smsProvider } = build([makeMember('gym-x', 'Member X')], {});

    const summary = await useCase.execute();

    expect(summary.membersSkippedBillingRestricted).toBe(1);
    expect(smsProvider.send).not.toHaveBeenCalled();
  });

  it('single-gym run (gymId input) is skipped entirely for a suspended gym', async () => {
    const { useCase, smsProvider } = build([makeMember('gym-s', 'Member Y')], {
      'gym-s': makeSubscription({ gymId: 'gym-s', status: SaasStatus.Suspended }),
    });

    const summary = await useCase.execute({ gymId: 'gym-s' });

    expect(summary.membersSkippedBillingRestricted).toBe(1);
    expect(summary.totalSent).toBe(0);
    expect(smsProvider.send).not.toHaveBeenCalled();
  });
});

describe('SendAutomatedReminders — expires-today notice to freshly expired members', () => {
  function build(
    members: Member[],
    subs: Record<string, Subscription>,
    expiredMembers: Member[] = []
  ) {
    const memberRepo = {
      findAllActiveMembers: jest.fn().mockResolvedValue(members),
      findActiveMembers: jest.fn(
        async (gymId: string) => members.filter((m) => m.gymId === gymId)
      ),
      findAllExpiredMembers: jest.fn().mockResolvedValue(expiredMembers),
      findExpiredMembers: jest.fn(
        async (gymId: string) => expiredMembers.filter((m) => m.gymId === gymId)
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
    subscriptionRepo.findByGymId.mockImplementation(async (gymId: string) => subs[gymId] ?? null);

    const useCase = new SendAutomatedReminders(memberRepo, smsRepo, smsProvider, subscriptionRepo);
    return { useCase, memberRepo, smsRepo, smsProvider, subscriptionRepo };
  }

  const subs = { 'gym-1': makeSubscription({ gymId: 'gym-1' }) };

  it('sends the due_today SMS ("expires today") to an expired member whose due date is today', async () => {
    const expiredToday = makeMember('gym-1', 'Expired Today', {
      status: MemberStatus.Expired,
      nextDueDate: daysFromToday(0),
    });
    const { useCase, smsProvider, smsRepo } = build([], subs, [expiredToday]);

    const summary = await useCase.execute();

    expect(summary.totalSent).toBe(1);
    expect(smsProvider.send).toHaveBeenCalledTimes(1);
    expect(smsProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('membership expires today'),
      })
    );
    expect(smsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ smsType: 'due_today' })
    );
  });

  it('does NOT message expired members past their expiry day (no overdue spam)', async () => {
    const longExpired = makeMember('gym-1', 'Long Expired', {
      status: MemberStatus.Expired,
      nextDueDate: daysFromToday(-3),
    });
    const { useCase, smsProvider } = build([], subs, [longExpired]);

    const summary = await useCase.execute();

    expect(summary.totalSent).toBe(0);
    expect(smsProvider.send).not.toHaveBeenCalled();
  });

  it('skips daily-plan members expiring today (daily plans get no reminders)', async () => {
    const dailyExpired = makeMember('gym-1', 'Daily Member', {
      status: MemberStatus.Expired,
      planType: PlanType.Daily,
      nextDueDate: daysFromToday(0),
    });
    const { useCase, smsProvider } = build([], subs, [dailyExpired]);

    const summary = await useCase.execute();

    expect(summary.totalSent).toBe(0);
    expect(smsProvider.send).not.toHaveBeenCalled();
  });

  it('does not send twice on the same day (due_today dedup)', async () => {
    const expiredToday = makeMember('gym-1', 'Expired Today', {
      status: MemberStatus.Expired,
      nextDueDate: daysFromToday(0),
    });
    const { useCase, smsProvider, smsRepo } = build([], subs, [expiredToday]);
    smsRepo.existsForToday.mockResolvedValue(true);

    const summary = await useCase.execute();

    expect(summary.totalSent).toBe(0);
    expect(smsProvider.send).not.toHaveBeenCalled();
  });

  it('applies the billing-status gate to expiring members too', async () => {
    const expiredToday = makeMember('gym-s', 'Expired Today', {
      status: MemberStatus.Expired,
      nextDueDate: daysFromToday(0),
    });
    const { useCase, smsProvider } = build([], {
      'gym-s': makeSubscription({ gymId: 'gym-s', status: SaasStatus.Suspended }),
    }, [expiredToday]);

    const summary = await useCase.execute();

    expect(summary.membersSkippedBillingRestricted).toBe(1);
    expect(smsProvider.send).not.toHaveBeenCalled();
  });
});
