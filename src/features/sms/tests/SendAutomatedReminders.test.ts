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
import type { IGymDirectory } from '@/features/sms/services/IGymDirectory'
import type { IDiscountDirectory } from '@/features/sms/services/IDiscountDirectory'
import type { Subscription } from '@/features/subscriptions/domain/Subscription'
import { SMSDeliveryStatus } from '@/features/sms/services/ISMSRepository'

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
  })
}

describe('SendAutomatedReminders — billing-status gate (reminders on every tier)', () => {
  function build(
    members: Member[],
    subs: Record<string, Subscription>,
    gymNames: Record<string, string> = {},
    discountPercentages: Record<string, number> = {}
  ) {
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

    const gymDirectory: jest.Mocked<IGymDirectory> = {
      findNamesByIds: jest.fn(
        async (ids: string[]) =>
          new Map(ids.map((id) => [id, gymNames[id] ?? `Gym ${id}`]))
      ),
    }

    const discountDirectory: jest.Mocked<IDiscountDirectory> = {
      findPercentagesByIds: jest.fn(
        async (ids: string[]) =>
          new Map(
            ids
              .filter((id) => id in discountPercentages)
              .map((id) => [id, discountPercentages[id]])
          )
      ),
    }

    const useCase = new SendAutomatedReminders(
      memberRepo,
      smsRepo,
      smsProvider,
      subscriptionRepo,
      gymDirectory,
      discountDirectory
    )
    return {
      useCase,
      memberRepo,
      smsRepo,
      smsProvider,
      subscriptionRepo,
      gymDirectory,
      discountDirectory,
    }
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

  it("names each member's own gym, loading every gym name in one read per run", async () => {
    const { useCase, smsProvider, smsRepo, gymDirectory } = build(
      [
        makeMember('gym-a', 'Member A'),
        makeMember('gym-a', 'Member B'),
        makeMember('gym-b', 'Member C'),
      ],
      {
        'gym-a': makeSubscription({ gymId: 'gym-a' }),
        'gym-b': makeSubscription({ gymId: 'gym-b' }),
      },
      { 'gym-a': 'Titan Fitness', 'gym-b': 'Atlas Fitness Center' }
    )

    await useCase.execute()

    expect(gymDirectory.findNamesByIds).toHaveBeenCalledTimes(1)
    expect(gymDirectory.findNamesByIds).toHaveBeenCalledWith(['gym-a', 'gym-b'])

    const messages = smsProvider.send.mock.calls.map(([sms]) => sms.message)
    expect(messages).toEqual([
      expect.stringMatching(
        /^Hi Member A, your monthly membership at Titan Fitness has expired/
      ),
      expect.stringMatching(
        /^Hi Member B, your monthly membership at Titan Fitness has expired/
      ),
      expect.stringMatching(
        /^Hi Member C, your monthly membership at Atlas Fitness Center has expired/
      ),
    ])
    const logged = (smsRepo.create as jest.Mock).mock.calls.map(
      ([log]) => log.messageBody
    )
    expect(logged).toEqual(messages)
  })

  it('asks only for the gyms that may receive reminders', async () => {
    const { useCase, gymDirectory } = build(
      [makeMember('gym-ok', 'Member A'), makeMember('gym-s', 'Member B')],
      {
        'gym-ok': makeSubscription({ gymId: 'gym-ok' }),
        'gym-s': makeSubscription({
          gymId: 'gym-s',
          status: SaasStatus.Suspended,
        }),
      }
    )

    await useCase.execute()

    expect(gymDirectory.findNamesByIds).toHaveBeenCalledWith(['gym-ok'])
  })

  it('reads no names when no gym may receive reminders', async () => {
    const { useCase, gymDirectory } = build([makeMember('gym-s', 'Member B')], {
      'gym-s': makeSubscription({
        gymId: 'gym-s',
        status: SaasStatus.Suspended,
      }),
    })

    await useCase.execute()

    expect(gymDirectory.findNamesByIds).not.toHaveBeenCalled()
  })

  it('sends nothing to a member whose gym name did not resolve, and reports it', async () => {
    const { useCase, smsProvider, gymDirectory } = build(
      [makeMember('gym-a', 'Member A')],
      {
        'gym-a': makeSubscription({ gymId: 'gym-a' }),
      }
    )
    gymDirectory.findNamesByIds.mockResolvedValue(new Map())

    const summary = await useCase.execute()

    expect(smsProvider.send).not.toHaveBeenCalled()
    expect(summary.totalSent).toBe(0)
    expect(summary.errors).toEqual([
      expect.stringContaining('Member A: gym name not found'),
    ])
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

  /**
   * Rule 2.7: every send logs success AND failure. A failed reminder used to
   * throw before its sms_logs insert, so no failure ever reached the member's
   * history or the system-health failures table.
   */
  describe('a failed send is logged', () => {
    const gym = { 'gym-a': makeSubscription({ gymId: 'gym-a' }) }

    it('logs the provider failure with its reason, and counts no send', async () => {
      const { useCase, smsProvider, smsRepo } = build(
        [makeMember('gym-a', 'Member A')],
        gym,
        { 'gym-a': 'Titan Fitness' }
      )
      smsProvider.send.mockResolvedValue({
        success: false,
        error: 'Insufficient credits',
      })

      const summary = await useCase.execute()

      expect(smsRepo.create).toHaveBeenCalledTimes(1)
      expect(smsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          smsType: 'overdue',
          deliveryStatus: SMSDeliveryStatus.Failed,
          textLkMessageId: null,
          errorMessage: 'Insufficient credits',
          messageBody: expect.stringContaining('at Titan Fitness'),
        })
      )
      expect(summary.totalSent).toBe(0)
      expect(summary.errors).toEqual([
        expect.stringContaining('Insufficient credits'),
      ])
    })

    it('logs a thrown provider error', async () => {
      const { useCase, smsProvider, smsRepo } = build(
        [makeMember('gym-a', 'Member A')],
        gym
      )
      smsProvider.send.mockRejectedValue(new Error('network down'))

      const summary = await useCase.execute()

      expect(smsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryStatus: SMSDeliveryStatus.Failed,
          errorMessage: 'network down',
        })
      )
      expect(summary.totalSent).toBe(0)
      expect(summary.errors).toHaveLength(1)
    })

    it('still reports the send failure when the failure log itself fails', async () => {
      const { useCase, smsProvider, smsRepo } = build(
        [makeMember('gym-a', 'Member A')],
        gym
      )
      smsProvider.send.mockResolvedValue({ success: false, error: 'No route' })
      ;(smsRepo.create as jest.Mock).mockRejectedValue(
        new Error('insert refused')
      )

      const summary = await useCase.execute()

      expect(summary.totalSent).toBe(0)
      expect(summary.errors).toEqual([expect.stringContaining('No route')])
    })

    it('logs a successful send once, as sent', async () => {
      const { useCase, smsRepo } = build([makeMember('gym-a', 'Member A')], gym)

      const summary = await useCase.execute()

      expect(smsRepo.create).toHaveBeenCalledTimes(1)
      expect(smsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryStatus: SMSDeliveryStatus.Sent,
          textLkMessageId: 'msg-1',
          errorMessage: null,
        })
      )
      expect(summary.totalSent).toBe(1)
    })
  })

  /**
   * A reminder quotes what the desk will charge: the plan amount less a
   * recurring discount (effectivePlanAmount), never the raw plan amount.
   */
  describe('recurring discounts', () => {
    const gym = { 'gym-a': makeSubscription({ gymId: 'gym-a' }) }
    const sent = (smsProvider: jest.Mocked<ISMSProvider>) =>
      smsProvider.send.mock.calls.map(([sms]) => sms.message)

    it('quotes the discounted amount to a member with a recurring discount', async () => {
      const { useCase, smsProvider } = build(
        [
          makeMember('gym-a', 'Member A', {
            discountId: 'disc-10',
            recurringDiscount: true,
          }),
        ],
        gym,
        {},
        { 'disc-10': 10 }
      )

      await useCase.execute()

      expect(sent(smsProvider)).toHaveLength(1)
      expect(sent(smsProvider)[0]).toContain('Rs.1,800)')
      expect(sent(smsProvider)[0]).not.toContain('Rs.2,000')
    })

    it('quotes the full amount when the discount does not recur', async () => {
      const { useCase, smsProvider, discountDirectory } = build(
        [
          makeMember('gym-a', 'Member A', {
            discountId: 'disc-10',
            recurringDiscount: false,
          }),
        ],
        gym,
        {},
        { 'disc-10': 10 }
      )

      await useCase.execute()

      expect(sent(smsProvider)[0]).toContain('Rs.2,000)')
      expect(discountDirectory.findPercentagesByIds).not.toHaveBeenCalled()
    })

    it('reads every discount it needs once per run, distinct ids only', async () => {
      const { useCase, smsProvider, discountDirectory } = build(
        [
          makeMember('gym-a', 'Member A', {
            discountId: 'disc-10',
            recurringDiscount: true,
          }),
          makeMember('gym-a', 'Member B', {
            discountId: 'disc-10',
            recurringDiscount: true,
          }),
          makeMember('gym-a', 'Member C', {
            discountId: 'disc-25',
            recurringDiscount: true,
          }),
          makeMember('gym-a', 'Member D'),
        ],
        gym,
        {},
        { 'disc-10': 10, 'disc-25': 25 }
      )

      await useCase.execute()

      expect(discountDirectory.findPercentagesByIds).toHaveBeenCalledTimes(1)
      expect(discountDirectory.findPercentagesByIds).toHaveBeenCalledWith([
        'disc-10',
        'disc-25',
      ])
      expect(sent(smsProvider)).toEqual([
        expect.stringContaining('Rs.1,800)'),
        expect.stringContaining('Rs.1,800)'),
        expect.stringContaining('Rs.1,500)'),
        expect.stringContaining('Rs.2,000)'),
      ])
    })

    it('reads no discounts when no member has a recurring one', async () => {
      const { useCase, discountDirectory } = build(
        [makeMember('gym-a', 'Member A')],
        gym
      )

      await useCase.execute()

      expect(discountDirectory.findPercentagesByIds).not.toHaveBeenCalled()
    })

    it('quotes the full amount when the discount row is gone', async () => {
      const { useCase, smsProvider } = build(
        [
          makeMember('gym-a', 'Member A', {
            discountId: 'disc-deleted',
            recurringDiscount: true,
          }),
        ],
        gym
      )

      await useCase.execute()

      expect(sent(smsProvider)[0]).toContain('Rs.2,000)')
    })
  })

  /**
   * The operator's never-text list (SMS_DISABLED_GYM_IDS): the E2E test gyms
   * run in production with valid-format seeded numbers. Their members are
   * skipped up front — no send, no failed row, no run error — and counted.
   */
  describe('gyms with texts disabled', () => {
    const env = { ...process.env }
    afterEach(() => {
      process.env = { ...env }
    })

    it('sends nothing to members of a disabled gym and counts them', async () => {
      process.env.SMS_DISABLED_GYM_IDS = 'gym-e2e'
      const { useCase, smsProvider, smsRepo } = build(
        [
          makeMember('gym-e2e', 'Seeded Member A'),
          makeMember('gym-e2e', 'Seeded Member B'),
          makeMember('gym-a', 'Customer Member'),
        ],
        {
          'gym-e2e': makeSubscription({ gymId: 'gym-e2e' }),
          'gym-a': makeSubscription({ gymId: 'gym-a' }),
        }
      )

      const summary = await useCase.execute()

      expect(smsProvider.send).toHaveBeenCalledTimes(1)
      expect(smsProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({ gymId: 'gym-a' })
      )
      expect(smsRepo.create).toHaveBeenCalledTimes(1)
      expect(summary.membersSkippedSmsDisabled).toBe(2)
      expect(summary.errors).toEqual([])
      expect(summary.totalSent).toBe(1)
    })

    it('skips nobody when no gym is disabled', async () => {
      delete process.env.SMS_DISABLED_GYM_IDS
      const { useCase, smsProvider } = build(
        [makeMember('gym-e2e', 'Seeded Member A')],
        { 'gym-e2e': makeSubscription({ gymId: 'gym-e2e' }) }
      )

      const summary = await useCase.execute()

      expect(smsProvider.send).toHaveBeenCalledTimes(1)
      expect(summary.membersSkippedSmsDisabled).toBe(0)
    })
  })
})
