/**
 * A gym's billing lapse must never lock its members out of the building.
 *
 * ## The inverted assumption
 *
 * "A customer who stops paying should stop receiving the service." True of
 * almost everything we sell — and catastrophic here. Invert it and ask what
 * treating a lapsed gym like a cancelled member would actually do: every
 * member of that gym is refused at the door, in person, over an invoice
 * dispute they are not party to and cannot resolve. People who paid their gym
 * on time stand outside a building they are entitled to enter.
 *
 * The service we withhold from a non-paying gym is the dashboard, not the
 * door. This suite pins that distinction in the two places it could quietly be
 * lost.
 *
 * ## What the design actually does
 *
 * Two independent paths, and the difference between them is the whole point:
 *
 *  - **The nightly reconcile skips a lapsed gym.** It is a diff, so skipping it
 *    changes nothing on the hardware — every member keeps the window their
 *    reader already holds, and the reader keeps enforcing it from its own
 *    clock. Covered in `ReconcileMemberAccess.test.ts`.
 *  - **The outbox drain does not consult billing at all.** So member-level
 *    events keep flowing while the gym is past due: a member who renews during
 *    the lapse still gets their validity period pushed and still gets in.
 *
 * The second is the one at risk. Adding a standing check to the drain looks
 * like an obvious saving — stop doing vendor work for a gym that is not paying
 * — and it would lock out the exact members this decision exists to protect.
 * That is what these tests are here to catch.
 */

import { DrainAccessSyncQueue } from '@/features/access-control/services/DrainAccessSyncQueue'
import { SyncMemberAccess } from '@/features/access-control/services/SyncMemberAccess'
import { OperateDevice } from '@/features/access-control/services/OperateDevice'
import { EvictInactiveSubjects } from '@/features/access-control/services/EvictInactiveSubjects'
import { ReconcileMemberAccess } from '@/features/access-control/services/ReconcileMemberAccess'
import { MockAccessControlProvider } from '@/lib/access-control'
import {
  SaasStatus,
  SaasTier,
} from '@/features/subscriptions/config/SubscriptionConfig'
import {
  makeSubscription,
  mockSubscriptionRepo,
} from '@/features/subscriptions/tests/subscription-mocks'
import { AccessIntent } from '@/features/access-control/config/AccessControlConfig'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import {
  FakeAccessControlRepository,
  day,
  makeContext,
  makeDevice,
  makeJob,
  makeSubject,
  testCredentials,
} from './fakes'

const TODAY = day('2026-01-10')

/** Every `.ts`/`.tsx` file under a directory, recursively. */
function sourceFilesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFilesUnder(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

/**
 * Gyms that are genuinely behind on their own bill.
 *
 * `past_due` alone is NOT one of them — `resolveStanding` treats it as in good
 * standing until the 7-day grace has run out, which is the point of having a
 * grace period. So the fixture has to carry a `currentPeriodEnd` old enough
 * for `isGraceExpired` to be true; with `currentPeriodEnd: null` (the default)
 * a past-due gym is in grace forever and reconciles normally.
 */
const LAPSED_GYMS = [
  ['suspended', { status: SaasStatus.Suspended }],
  [
    'past due beyond grace',
    {
      status: SaasStatus.PastDue,
      currentPeriodEnd: new Date('2025-11-01T00:00:00Z'),
    },
  ],
] as const

describe('a gym billing lapse never locks members out', () => {
  describe('the drain is billing-blind, so renewals keep reaching the door', () => {
    it.each(LAPSED_GYMS)(
      'pushes a renewed validity period for a member of a %s gym',
      async () => {
        // The member paid their gym. The gym has not paid us. The reader must
        // still be told the member is good for another month.
        const repo = new FakeAccessControlRepository({
          credentials: testCredentials,
          devices: [makeDevice()],
          contexts: [
            makeContext({
              nextDueDate: day('2026-02-15'),
              subject: makeSubject({
                // What the reader currently holds — last month's window.
                last_synced_valid_to: '2026-01-15',
              }),
            }),
          ],
          claimable: [makeJob({ intent: AccessIntent.ReconcileMember })],
        })

        const provider = new MockAccessControlProvider()

        const drain = new DrainAccessSyncQueue(
          repo,
          new SyncMemberAccess(repo, provider),
          new OperateDevice(repo, provider),
          new EvictInactiveSubjects(repo, provider),
          provider
        )

        const summary = await drain.execute({ today: TODAY })

        expect(summary.claimed).toBe(1)
        expect(summary.succeeded).toBe(1)

        // The reader was actually told. Not "we decided they were allowed" —
        // a command went out.
        expect(provider.getCommands().length).toBeGreaterThan(0)
      }
    )

    it('takes no subscription repository at all', () => {
      // The structural version of the same guarantee, and the more durable
      // one: the drain cannot consult billing standing because nothing ever
      // hands it a way to. Adding that dependency is the change this test
      // exists to make someone justify.
      expect(DrainAccessSyncQueue.length).toBe(5)

      const repo = new FakeAccessControlRepository({})
      const provider = new MockAccessControlProvider()

      const drain = new DrainAccessSyncQueue(
        repo,
        new SyncMemberAccess(repo, provider),
        new OperateDevice(repo, provider),
        new EvictInactiveSubjects(repo, provider),
        provider
      )

      expect(drain).toBeInstanceOf(DrainAccessSyncQueue)
    })
  })

  describe('the reconciler skips rather than revokes', () => {
    it.each(LAPSED_GYMS)(
      'enqueues nothing at all for a %s gym — least of all a block',
      async (_label, billing) => {
        const repo = new FakeAccessControlRepository({
          credentials: testCredentials,
          contexts: [
            makeContext({
              subject: makeSubject({ last_synced_blocked: false }),
            }),
          ],
          gymsWithAccessControl: ['gym-1'],
        })

        const subscriptionRepo = mockSubscriptionRepo()
        subscriptionRepo.findByGymId.mockResolvedValue(
          makeSubscription({
            gymId: 'gym-1',
            tier: SaasTier.Enterprise,
            ...billing,
          })
        )

        const provider = new MockAccessControlProvider()

        const summary = await new ReconcileMemberAccess(
          repo,
          subscriptionRepo,
          new EvictInactiveSubjects(repo, provider),
          provider
        ).execute({ today: TODAY })

        expect(summary.gymsSkippedBilling).toBe(1)

        // Skipping is a `continue`, never a "block everyone" branch. The
        // distinction is invisible in the summary — both would read as the
        // gym being handled — so it is asserted on the queue itself.
        expect(repo.enqueued).toHaveLength(0)
        expect(
          repo.enqueued.filter((job) => job.intent === AccessIntent.Block)
        ).toHaveLength(0)
        expect(provider.getCommands()).toHaveLength(0)
      }
    )

    it('leaves the window the reader already holds untouched', async () => {
      // The reason skipping is safe at all: the terminal enforces validity
      // from its own RTC, so doing nothing is not the same as doing nothing
      // *yet*. A member paid through March gets in until March whether or not
      // we ever speak to that reader again.
      const subject = makeSubject({
        last_synced_valid_to: '2026-03-15',
        last_synced_blocked: false,
      })

      const repo = new FakeAccessControlRepository({
        credentials: testCredentials,
        contexts: [makeContext({ subject })],
        gymsWithAccessControl: ['gym-1'],
      })

      const subscriptionRepo = mockSubscriptionRepo()
      subscriptionRepo.findByGymId.mockResolvedValue(
        makeSubscription({
          gymId: 'gym-1',
          tier: SaasTier.Enterprise,
          status: SaasStatus.Suspended,
        })
      )

      const provider = new MockAccessControlProvider()

      await new ReconcileMemberAccess(
        repo,
        subscriptionRepo,
        new EvictInactiveSubjects(repo, provider),
        provider
      ).execute({ today: TODAY })

      expect(subject.last_synced_valid_to).toBe('2026-03-15')
      expect(subject.last_synced_blocked).toBe(false)
      expect(repo.syncStates.size).toBe(0)
    })
  })

  describe('nothing in billing reaches the door', () => {
    it('gives the subscriptions feature no way to queue door work', () => {
      // Belt and braces for the rule above, asserted as a real read of the
      // source rather than as a claim in a comment, because the claim is what
      // rots. No dunning, suspension or trial-expiry path can enqueue a block
      // even by accident, because none of them can name an intent or the
      // outbox table.
      //
      // Scoped deliberately: `subscriptions` *does* and *must* mention
      // access control — `PlanRestrictions` owns the `accessControlHardware`
      // capability flag, which is the entitlement gate. Deciding whether a gym
      // may use door hardware is billing's job. Reaching into the queue that
      // drives the doors is not.
      const offenders = sourceFilesUnder('src/features/subscriptions').filter(
        (file) =>
          /AccessIntent|access_sync_jobs/.test(readFileSync(file, 'utf8'))
      )

      expect(offenders).toEqual([])
    })
  })
})
