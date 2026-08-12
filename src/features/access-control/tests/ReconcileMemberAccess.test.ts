/**
 * The nightly diff.
 *
 * Two properties matter here and neither is obvious from the code alone:
 *
 *  1. **It enqueues only what changed.** There is no bulk validity endpoint, so
 *     re-asserting a 500-member gym nightly is 500 HTTP calls to change
 *     nothing — and every one of them is another chance for firmware to
 *     disturb an existing block.
 *  2. **Skipping a lapsed gym leaves its members' access intact.** That is the
 *     opposite effect to the SMS equivalent, and it only holds because the
 *     device enforces the window from its own clock.
 */

import { ReconcileMemberAccess } from '@/features/access-control/services/ReconcileMemberAccess'
import {
  SaasStatus,
  SaasTier,
} from '@/features/subscriptions/config/SubscriptionConfig'
import {
  makeSubscription,
  mockSubscriptionRepo,
} from '@/features/subscriptions/tests/subscription-mocks'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { AccessIntent } from '@/features/access-control/config/AccessControlConfig'
import type { Subscription } from '@/features/subscriptions/domain/Subscription'
import {
  FakeAccessControlRepository,
  day,
  makeContext,
  makeSubject,
  testCredentials,
} from './fakes'

const TODAY = day('2026-01-10')

function build(
  contexts: ReturnType<typeof makeContext>[],
  subscriptions: Record<string, Subscription | null> = {
    'gym-1': makeSubscription({
      gymId: 'gym-1',
      tier: SaasTier.Enterprise,
      status: SaasStatus.Active,
    }),
  },
  gymIds: string[] = ['gym-1']
) {
  const repo = new FakeAccessControlRepository({
    credentials: testCredentials,
    contexts,
    gymsWithAccessControl: gymIds,
  })

  const subscriptionRepo = mockSubscriptionRepo()
  subscriptionRepo.findByGymId.mockImplementation(
    async (gymId: string) => subscriptions[gymId] ?? null
  )

  return {
    repo,
    subscriptionRepo,
    useCase: new ReconcileMemberAccess(repo, subscriptionRepo),
  }
}

describe('ReconcileMemberAccess', () => {
  describe('diffing', () => {
    it('enqueues nothing when the hardware already holds the right window', async () => {
      const { repo, useCase } = build([
        makeContext({
          nextDueDate: day('2026-01-15'),
          subject: makeSubject({
            last_synced_valid_from: '2025-12-15',
            last_synced_valid_to: '2026-01-15',
            last_synced_blocked: false,
          }),
        }),
      ])

      const summary = await useCase.execute({ today: TODAY })

      expect(summary.membersChecked).toBe(1)
      expect(summary.membersEnqueued).toBe(0)
      expect(repo.enqueued).toHaveLength(0)
    })

    it('enqueues once when the paid-through date has moved', async () => {
      const { repo, useCase } = build([
        makeContext({
          nextDueDate: day('2026-02-15'),
          subject: makeSubject({
            last_synced_valid_from: '2025-12-15',
            last_synced_valid_to: '2026-01-15',
            last_synced_blocked: false,
          }),
        }),
      ])

      const summary = await useCase.execute({ today: TODAY })

      expect(summary.membersEnqueued).toBe(1)
      expect(repo.enqueued).toEqual([
        {
          gymId: 'gym-1',
          memberId: 'member-1',
          intent: AccessIntent.ReconcileMember,
          payload: { reason: 'nightly_reconcile' },
        },
      ])
    })

    it('enqueues a member who has just been suspended', async () => {
      const { useCase } = build([
        makeContext({
          status: MemberStatus.Suspended,
          subject: makeSubject({
            last_synced_valid_from: '2025-12-15',
            last_synced_valid_to: '2026-01-15',
            last_synced_blocked: false,
          }),
        }),
      ])

      const summary = await useCase.execute({ today: TODAY })

      expect(summary.membersEnqueued).toBe(1)
    })

    it('does not treat a stored DATE as different from the device format', async () => {
      // `2026-01-15` and `20260115` are the same day. Comparing them raw would
      // report every member as changed, every single night.
      const { useCase } = build([
        makeContext({
          nextDueDate: day('2026-01-15'),
          subject: makeSubject({
            last_synced_valid_from: '2025-12-15T00:00:00Z',
            last_synced_valid_to: '2026-01-15T00:00:00Z',
            last_synced_blocked: false,
          }),
        }),
      ])

      const summary = await useCase.execute({ today: TODAY })

      expect(summary.membersEnqueued).toBe(0)
    })

    it('skips members who have never been provisioned', async () => {
      const { useCase } = build([makeContext({ subject: null })])

      const summary = await useCase.execute({ today: TODAY })

      expect(summary.membersEnqueued).toBe(0)
    })
  })

  describe('gym billing standing', () => {
    it.each([
      ['trialing', SaasStatus.Trialing],
      ['active', SaasStatus.Active],
    ])('reconciles a %s gym', async (_label, status) => {
      const { useCase } = build(
        [makeContext({ subject: makeSubject({ last_synced_blocked: true }) })],
        {
          'gym-1': makeSubscription({
            gymId: 'gym-1',
            tier: SaasTier.Enterprise,
            status,
          }),
        }
      )

      const summary = await useCase.execute({ today: TODAY })

      expect(summary.gymsSkippedBilling).toBe(0)
      expect(summary.membersEnqueued).toBe(1)
    })

    it('skips a suspended gym without touching its members', async () => {
      const { repo, useCase } = build(
        [makeContext({ subject: makeSubject({ last_synced_blocked: true }) })],
        {
          'gym-1': makeSubscription({
            gymId: 'gym-1',
            tier: SaasTier.Enterprise,
            status: SaasStatus.Suspended,
          }),
        }
      )

      const summary = await useCase.execute({ today: TODAY })

      expect(summary.gymsSkippedBilling).toBe(1)
      expect(summary.membersChecked).toBe(0)
      // The point of the test: nothing was queued, so every member keeps the
      // access their reader already holds. A billing dispute must not lock out
      // members who paid.
      expect(repo.enqueued).toHaveLength(0)
    })

    it('fails closed when the gym has no subscription at all', async () => {
      const { useCase } = build([makeContext()], { 'gym-1': null })

      const summary = await useCase.execute({ today: TODAY })

      expect(summary.gymsSkippedBilling).toBe(1)
    })

    it.each([
      ['Lite', SaasTier.Lite],
      ['Pro', SaasTier.Pro],
    ])(
      'skips a paid-up %s gym, which is not entitled to hardware',
      async (_label, tier) => {
        const { repo, useCase } = build(
          [
            makeContext({
              subject: makeSubject({ last_synced_blocked: true }),
            }),
          ],
          { 'gym-1': makeSubscription({ gymId: 'gym-1', tier }) }
        )

        const summary = await useCase.execute({ today: TODAY })

        // Counted apart from a billing lapse: "you downgraded" and "pay your
        // bill" need different answers from whoever reads the cron log.
        expect(summary.gymsSkippedNotEntitled).toBe(1)
        expect(summary.gymsSkippedBilling).toBe(0)
        expect(repo.enqueued).toHaveLength(0)
      }
    )

    it('reconciles a past-due gym still inside its grace period', async () => {
      const { useCase } = build(
        [makeContext({ subject: makeSubject({ last_synced_blocked: true }) })],
        {
          'gym-1': makeSubscription({
            gymId: 'gym-1',
            tier: SaasTier.Enterprise,
            status: SaasStatus.PastDue,
            currentPeriodEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
          }),
        }
      )

      const summary = await useCase.execute({ today: TODAY })

      expect(summary.gymsSkippedBilling).toBe(0)
    })
  })

  describe('sweep behaviour', () => {
    it('carries on after one gym fails', async () => {
      const { repo, useCase } = build(
        [makeContext({ gymId: 'gym-2', memberId: 'member-2' })],
        {
          'gym-1': makeSubscription({
            gymId: 'gym-1',
            tier: SaasTier.Enterprise,
          }),
          'gym-2': makeSubscription({
            gymId: 'gym-2',
            tier: SaasTier.Enterprise,
          }),
        },
        ['gym-1', 'gym-2']
      )

      jest
        .spyOn(repo, 'listSubjectsForReconcile')
        .mockImplementation(async (gymId: string) => {
          if (gymId === 'gym-1') throw new Error('gym-1 read failed')
          return [
            makeContext({
              gymId: 'gym-2',
              memberId: 'member-2',
              subject: makeSubject({ last_synced_blocked: true }),
            }),
          ]
        })

      const summary = await useCase.execute({ today: TODAY })

      expect(summary.errors).toHaveLength(1)
      expect(summary.errors[0]).toContain('gym-1')
      expect(summary.membersEnqueued).toBe(1)
    })

    it('limits itself to one gym when asked', async () => {
      const { subscriptionRepo, useCase } = build([makeContext()], undefined, [
        'gym-1',
        'gym-2',
      ])

      await useCase.execute({ gymId: 'gym-1', today: TODAY })

      expect(subscriptionRepo.findByGymId).toHaveBeenCalledTimes(1)
      expect(subscriptionRepo.findByGymId).toHaveBeenCalledWith('gym-1')
    })
  })
})
