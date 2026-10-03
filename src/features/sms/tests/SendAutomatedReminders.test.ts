import { SendAutomatedReminders } from '@/features/sms/services/SendAutomatedReminders'
import { Member } from '@/features/members/domain/Member'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { PlanType } from '@/features/members/config/PlanConfig'
import {
  SaasTier,
  SaasStatus,
} from '@/features/subscriptions/config/SubscriptionConfig'
import {
  makeSubscription,
  mockSubscriptionRepo,
} from '@/features/subscriptions/tests/subscription-mocks'
import type { IMemberRepository } from '@/features/members/services/IMemberRepository'
import type { ISMSRepository } from '@/features/sms/services/ISMSRepository'
import type { ISMSProvider } from '@/features/sms/services/ISMSProvider'
import type { Subscription } from '@/features/subscriptions/domain/Subscription'

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
  })
}

describe('SendAutomatedReminders — billing-status gate (reminders on every tier)', () => {
  function build(members: Member[], subs: Record<string, Subscription>) {
    const memberRepo = {
      findAllActiveMembers: jest.fn().mockResolvedValue(members),
      findActiveMembers: jest.fn(async (gymId: string) =>
        members.filter((m) => m.gymId === gymId)
      ),
    } as unknown as jest.Mocked<IMemberRepository>

    const smsRepo = {
      existsForToday: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockResolvedValue({ id: 'log-1' }),
    } as unknown as jest.Mocked<ISMSRepository>

    const smsProvider = {
      send: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-1' }),
    } as unknown as jest.Mocked<ISMSProvider>

    const subscriptionRepo = mockSubscriptionRepo()
    subscriptionRepo.findByGymId.mockImplementation(
      async (gymId: string) => subs[gymId] ?? null
    )

    const useCase = new SendAutomatedReminders(
      memberRepo,
      smsRepo,
      smsProvider,
      subscriptionRepo
    )
    return { useCase, memberRepo, smsRepo, smsProvider, subscriptionRepo }
  }

  it('sends for every tier — Lite, Pro and Enterprise members all get reminders', async () => {
    const { useCase, smsProvider } = build(
      [
        makeMember('gym-lite', 'Lite Member'),
        makeMember('gym-pro', 'Pro Member'),
        makeMember('gym-ent', 'Enterprise Member'),
      ],
      {
        'gym-lite': makeSubscription({
          gymId: 'gym-lite',
          tier: SaasTier.Lite,
        }),
        'gym-pro': makeSubscription({ gymId: 'gym-pro', tier: SaasTier.Pro }),
        'gym-ent': makeSubscription({
          gymId: 'gym-ent',
          tier: SaasTier.Enterprise,
        }),
      }
    )

    const summary = await useCase.execute()

    expect(summary.membersSkippedBillingRestricted).toBe(0)
    expect(smsProvider.send).toHaveBeenCalledTimes(3)
  })

  it('sends while trialing (full features during the trial window)', async () => {
    const { useCase, smsProvider } = build(
      [makeMember('gym-t', 'Trial Member')],
      {
        'gym-t': makeSubscription({
          gymId: 'gym-t',
          status: SaasStatus.Trialing,
        }),
      }
    )

    const summary = await useCase.execute()

    expect(summary.membersSkippedBillingRestricted).toBe(0)
    expect(smsProvider.send).toHaveBeenCalledTimes(1)
  })

  it('sends for canceled while paid-through; halts once the period lapses and for suspended', async () => {
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
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
    )

    const summary = await useCase.execute()

    expect(summary.membersSkippedBillingRestricted).toBe(2)
    expect(smsProvider.send).toHaveBeenCalledTimes(1)
  })

  it('sends for past_due within grace; halts past grace', async () => {
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    const { useCase, smsProvider } = build(
      [
        makeMember('gym-grace', 'In Grace'),
        makeMember('gym-lapsed', 'Past Grace'),
      ],
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
    )

    const summary = await useCase.execute()

    expect(summary.membersSkippedBillingRestricted).toBe(1)
    expect(smsProvider.send).toHaveBeenCalledTimes(1)
  })

  it('resolves each distinct gym once, not per member', async () => {
    const { useCase, subscriptionRepo } = build(
      [
        makeMember('gym-a', 'Member A'),
        makeMember('gym-a', 'Member B'),
        makeMember('gym-b', 'Member C'),
      ],
      {
        'gym-a': makeSubscription({ gymId: 'gym-a' }),
        'gym-b': makeSubscription({ gymId: 'gym-b' }),
      }
    )

    await useCase.execute()

    expect(subscriptionRepo.findByGymId).toHaveBeenCalledTimes(2)
  })

  it('fails closed: a gym with no resolvable subscription row is treated as restricted', async () => {
    const { useCase, smsProvider } = build(
      [makeMember('gym-x', 'Member X')],
      {}
    )

    const summary = await useCase.execute()

    expect(summary.membersSkippedBillingRestricted).toBe(1)
    expect(smsProvider.send).not.toHaveBeenCalled()
  })

  it('single-gym run (gymId input) is skipped entirely for a suspended gym', async () => {
    const { useCase, smsProvider } = build([makeMember('gym-s', 'Member Y')], {
      'gym-s': makeSubscription({
        gymId: 'gym-s',
        status: SaasStatus.Suspended,
      }),
    })

    const summary = await useCase.execute({ gymId: 'gym-s' })

    expect(summary.membersSkippedBillingRestricted).toBe(1)
    expect(summary.totalSent).toBe(0)
    expect(smsProvider.send).not.toHaveBeenCalled()
  })
})
