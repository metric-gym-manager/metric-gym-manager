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
import { EvictInactiveSubjects } from '@/features/access-control/services/EvictInactiveSubjects'
import { MockAccessControlProvider } from '@/lib/access-control'
import {
  SaasStatus,
  SaasTier,
} from '@/features/subscriptions/config/SubscriptionConfig'
import {
  makeSubscription,
  mockSubscriptionRepo,
} from '@/features/subscriptions/tests/subscription-mocks'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import {
  AccessDenialReason,
  AccessIntent,
} from '@/features/access-control/config/AccessControlConfig'
import { deriveAccessCommands } from '@/features/access-control/domain/AccessCommands'
import type { AccessSubjectInfo } from '@/lib/access-control'
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
    // An empty vendor list, deliberately: these cases are about the local
    // diff, and an unreadable vendor answer falls back to exactly that. The
    // vendor-sourced comparison has its own describe block below.
    useCase: new ReconcileMemberAccess(
      repo,
      subscriptionRepo,
      new EvictInactiveSubjects(repo, new MockAccessControlProvider()),
      new MockAccessControlProvider()
    ),
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

/**
 * Comparing against the vendor's own account of the state (F28).
 *
 * The diff used to ask "does the hardware hold what we last wrote down that we
 * sent?" — a question whose answer is our own record on both sides. Audit
 * Y1 showed exactly how that fails: a duplicate command misread as permanent
 * left two members correct on the reader and blocked in our database, and
 * nothing in the nightly sweep could notice, because our record agreed with
 * itself.
 *
 * `GET /api/template` carries `StartDate`, `EndDate` and `IsSync` per subject.
 * Measured against the live account on 2026-09-23: they arrive as `YYYYMMDD`
 * strings — the device's own form — so they compare directly against what the
 * decision engine wants pushed.
 */
describe('ReconcileMemberAccess — vendor as the comparison source', () => {
  function vendorSubject(
    overrides: Partial<{
      subjectId: string
      validFrom: string | null
      validTo: string | null
      syncedToVendor: boolean | null
      deleted: boolean | null
    }> = {}
  ) {
    return {
      subjectId: '100001',
      name: 'Test Member',
      areaId: 1,
      templateCount: null,
      validFrom: '20251215',
      validTo: '20260115',
      syncedToVendor: true,
      deleted: false,
      ...overrides,
    }
  }

  function buildWithVendor(
    contexts: ReturnType<typeof makeContext>[],
    vendorSubjects: ReturnType<typeof vendorSubject>[]
  ) {
    const repo = new FakeAccessControlRepository({
      credentials: testCredentials,
      contexts,
      gymsWithAccessControl: ['gym-1'],
    })

    const subscriptionRepo = mockSubscriptionRepo()
    subscriptionRepo.findByGymId.mockImplementation(async () =>
      makeSubscription({
        gymId: 'gym-1',
        tier: SaasTier.Enterprise,
        status: SaasStatus.Active,
      })
    )

    const provider = new MockAccessControlProvider()
    provider.setSubjects(vendorSubjects)

    return {
      repo,
      provider,
      useCase: new ReconcileMemberAccess(
        repo,
        subscriptionRepo,
        new EvictInactiveSubjects(repo, provider),
        provider
      ),
    }
  }

  it('enqueues a member the vendor disagrees about, even when our own record looks correct', async () => {
    // The Y1 shape: our last-write record says we pushed the right window, so
    // the old diff is satisfied. The vendor holds last month's date.
    const { repo, useCase } = buildWithVendor(
      [
        makeContext({
          nextDueDate: day('2026-01-15'),
          subject: makeSubject({
            last_synced_valid_from: '2025-12-15',
            last_synced_valid_to: '2026-01-15',
            last_synced_blocked: false,
          }),
        }),
      ],
      [vendorSubject({ validTo: '20251215' })]
    )

    const summary = await useCase.execute({ today: TODAY })

    expect(summary.membersEnqueued).toBe(1)
    expect(summary.vendorDrift).toBe(1)
    expect(repo.enqueued).toHaveLength(1)
  })

  it('enqueues nothing when the vendor already holds the right window', async () => {
    const { repo, useCase } = buildWithVendor(
      [
        makeContext({
          nextDueDate: day('2026-01-15'),
          // Deliberately EMPTY on our side: the vendor is the authority now,
          // so a member we have no local record of pushing must not be
          // re-pushed when the vendor plainly holds the right window.
          subject: makeSubject({
            last_synced_valid_from: null,
            last_synced_valid_to: null,
            last_synced_blocked: false,
          }),
        }),
      ],
      [vendorSubject()]
    )

    const summary = await useCase.execute({ today: TODAY })

    expect(summary.membersEnqueued).toBe(0)
    expect(repo.enqueued).toHaveLength(0)
  })

  it('enqueues a member the vendor has never heard of', async () => {
    const { useCase } = buildWithVendor(
      [
        makeContext({
          nextDueDate: day('2026-01-15'),
          subject: makeSubject({
            last_synced_valid_from: '2025-12-15',
            last_synced_valid_to: '2026-01-15',
            last_synced_blocked: false,
          }),
        }),
      ],
      [vendorSubject({ subjectId: '999999' })]
    )

    const summary = await useCase.execute({ today: TODAY })

    expect(summary.membersEnqueued).toBe(1)
    expect(summary.vendorDrift).toBe(1)
  })

  it('enqueues a member the vendor has flagged deleted', async () => {
    const { useCase } = buildWithVendor(
      [
        makeContext({
          nextDueDate: day('2026-01-15'),
          subject: makeSubject({
            last_synced_valid_from: '2025-12-15',
            last_synced_valid_to: '2026-01-15',
          }),
        }),
      ],
      [vendorSubject({ deleted: true })]
    )

    expect((await useCase.execute({ today: TODAY })).membersEnqueued).toBe(1)
  })

  it('enqueues when the vendor says a member we believe is on a reader is unsynced', async () => {
    const { useCase } = buildWithVendor(
      [
        makeContext({
          nextDueDate: day('2026-01-15'),
          subject: makeSubject({
            synced_device_serials: ['SER-001'],
            last_synced_valid_from: '2025-12-15',
            last_synced_valid_to: '2026-01-15',
          }),
        }),
      ],
      [vendorSubject({ syncedToVendor: false })]
    )

    expect((await useCase.execute({ today: TODAY })).membersEnqueued).toBe(1)
  })

  it('does not enqueue an unsynced member no reader is supposed to hold', async () => {
    // The vendor agreeing with us is not drift. A cancelled member is off every
    // reader on purpose, and IsSync=0 says exactly that.
    const { useCase } = buildWithVendor(
      [
        makeContext({
          nextDueDate: day('2026-01-15'),
          subject: makeSubject({
            synced_device_serials: [],
            last_synced_valid_from: '2025-12-15',
            last_synced_valid_to: '2026-01-15',
          }),
        }),
      ],
      [vendorSubject({ syncedToVendor: false })]
    )

    expect((await useCase.execute({ today: TODAY })).membersEnqueued).toBe(0)
  })

  /**
   * The V1 hazard, pointed at the reconciler.
   *
   * `listSubjects` answers `[]` for a payload it cannot parse — that is how an
   * account with two readers reported none. An empty list read as "the vendor
   * holds nobody" would enqueue every provisioned member of every gym, which
   * is the 500-call stampede the diff exists to prevent. Absence of evidence
   * has to fall back to our own record.
   */
  it('falls back to our own record when the vendor list is empty', async () => {
    const { repo, useCase } = buildWithVendor(
      [
        makeContext({
          nextDueDate: day('2026-01-15'),
          subject: makeSubject({
            last_synced_valid_from: '2025-12-15',
            last_synced_valid_to: '2026-01-15',
            last_synced_blocked: false,
          }),
        }),
      ],
      []
    )

    const summary = await useCase.execute({ today: TODAY })

    expect(summary.membersEnqueued).toBe(0)
    expect(summary.gymsVendorUnreadable).toBe(1)
    expect(repo.enqueued).toHaveLength(0)
  })

  it('falls back to our own record when the vendor call fails, without failing the gym', async () => {
    const { provider, useCase } = buildWithVendor(
      [
        makeContext({
          nextDueDate: day('2026-02-15'),
          subject: makeSubject({
            last_synced_valid_from: '2025-12-15',
            last_synced_valid_to: '2026-01-15',
            last_synced_blocked: false,
          }),
        }),
      ],
      [vendorSubject()]
    )

    jest
      .spyOn(provider, 'listSubjects')
      .mockRejectedValue(new Error('vendor unreachable'))

    const summary = await useCase.execute({ today: TODAY })

    // The local diff still notices the date moved, and the gym is not skipped.
    expect(summary.membersEnqueued).toBe(1)
    expect(summary.gymsVendorUnreadable).toBe(1)
    expect(summary.errors).toHaveLength(0)
  })

  it('still blocks from our own record, which the vendor does not expose', async () => {
    // `GET /api/template` has no block field — 19 fields, measured. So a member
    // whose window matches but who should be blocked is still caught here.
    const { useCase } = buildWithVendor(
      [
        makeContext({
          status: MemberStatus.Suspended,
          nextDueDate: day('2026-01-15'),
          subject: makeSubject({
            last_synced_valid_from: '2025-12-15',
            last_synced_valid_to: '2026-01-15',
            last_synced_blocked: false,
          }),
        }),
      ],
      [vendorSubject()]
    )

    expect((await useCase.execute({ today: TODAY })).membersEnqueued).toBe(1)
  })

  it('reads only our own subjects out of an account-wide list', async () => {
    // The account is shared: `listSubjects` returns other companies' people.
    // Matching must be a lookup of OUR subject id, never a scan of their list.
    const { useCase } = buildWithVendor(
      [
        makeContext({
          nextDueDate: day('2026-01-15'),
          subject: makeSubject({
            subject_id: 100001,
            last_synced_valid_from: '2025-12-15',
            last_synced_valid_to: '2026-01-15',
          }),
        }),
      ],
      [
        vendorSubject({ subjectId: '500000', validTo: '19990101' }),
        vendorSubject(),
        vendorSubject({ subjectId: '500001', validTo: '19990101' }),
      ]
    )

    expect((await useCase.execute({ today: TODAY })).membersEnqueued).toBe(0)
  })

  it('makes one vendor call per gym, not one per member', async () => {
    const { provider, useCase } = buildWithVendor(
      [
        makeContext({ memberId: 'member-1' }),
        makeContext({
          memberId: 'member-2',
          subject: makeSubject({ member_id: 'member-2', subject_id: 100002 }),
        }),
      ],
      [vendorSubject(), vendorSubject({ subjectId: '100002' })]
    )

    await useCase.execute({ today: TODAY })

    expect(provider.getCommandsOfType('listSubjects')).toHaveLength(1)
  })
})

/**
 * The no-op loop (F35), measured in production on 2026-09-23.
 *
 * Triggering the reconcile enqueued a suspended member who had never been
 * provisioned. The drain claimed it two minutes later and marked it
 * SUCCEEDED — and the subject row was byte-identical afterwards, because
 * `deriveAccessCommands` correctly produces NO commands for a member who
 * cannot enter and is on no reader. `SyncMemberAccess` writes back only when
 * it sent something, so nothing ever recorded that this is the settled state,
 * and the next run enqueued the same member again. It cannot converge.
 *
 * The cost is not the wasted job. It is that `membersEnqueued` never reaches
 * zero, so the night something really changes looks exactly like every other
 * night.
 */
describe('ReconcileMemberAccess — members the hardware has no work for', () => {
  function build(
    contexts: ReturnType<typeof makeContext>[],
    vendorSubjects: AccessSubjectInfo[] = []
  ) {
    const repo = new FakeAccessControlRepository({
      credentials: testCredentials,
      contexts,
      gymsWithAccessControl: ['gym-1'],
    })

    const subscriptionRepo = mockSubscriptionRepo()
    subscriptionRepo.findByGymId.mockImplementation(async () =>
      makeSubscription({
        gymId: 'gym-1',
        tier: SaasTier.Enterprise,
        status: SaasStatus.Active,
      })
    )

    const provider = new MockAccessControlProvider()
    provider.setSubjects(vendorSubjects)

    return {
      repo,
      useCase: new ReconcileMemberAccess(
        repo,
        subscriptionRepo,
        new EvictInactiveSubjects(repo, provider),
        provider
      ),
    }
  }

  /** A member who cannot enter, is on no reader, and was never provisioned. */
  const nothingToDo = () =>
    makeContext({
      status: MemberStatus.Suspended,
      subject: makeSubject({
        provisioned_at: null,
        synced_device_serials: [],
        last_synced_valid_from: null,
        last_synced_valid_to: null,
        last_synced_blocked: null,
      }),
    })

  it('does not enqueue a member no command could change', async () => {
    const { repo, useCase } = build([nothingToDo()])

    const summary = await useCase.execute({ today: TODAY })

    expect(summary.membersEnqueued).toBe(0)
    expect(summary.membersNothingToDo).toBe(1)
    expect(repo.enqueued).toHaveLength(0)
    // Still counted as checked: they were looked at, and a member who vanished
    // from the sweep entirely would be a different kind of wrong.
    expect(summary.membersChecked).toBe(1)
  })

  /**
   * The skip has to be a strict subset of "the sync would do nothing", or it
   * becomes a way to lose work. This asserts the relationship against the pure
   * function itself, so a later change to that branch fails here rather than
   * silently widening what the reconciler skips.
   */
  it('skips only a shape the command derivation itself answers with nothing', () => {
    const commands = deriveAccessCommands({
      decision: {
        allowed: false,
        reason: AccessDenialReason.Suspended,
        validFrom: null,
        validTo: null,
        // Suspended, not cancelled: the record stays on the hardware. Building
        // the decision by hand here is deliberate — this test is about the
        // command derivation's answer to one exact shape, and deriving it
        // through a member fixture would let the shape drift out from under it.
        removeFromDevice: false,
      },
      subject: {
        subjectId: '100001',
        memberName: 'Test Member',
        provisioned: false,
        syncedDeviceSerials: [],
        lastSyncedValidFrom: null,
        lastSyncedValidTo: null,
        lastSyncedBlocked: null,
      },
      deviceSerials: ['SER-001'],
    })

    expect(commands).toHaveLength(0)
  })

  it('still enqueues a blocked member a reader is holding', async () => {
    // The door is the point. Someone on a reader who may not enter needs
    // blocking, and skipping them would leave it open.
    const { repo, useCase } = build([
      makeContext({
        status: MemberStatus.Suspended,
        subject: makeSubject({
          provisioned_at: '2026-01-01T00:00:00Z',
          synced_device_serials: ['SER-001'],
          last_synced_blocked: false,
        }),
      }),
    ])

    const summary = await useCase.execute({ today: TODAY })

    expect(summary.membersEnqueued).toBe(1)
    expect(summary.membersNothingToDo).toBe(0)
    expect(repo.enqueued).toHaveLength(1)
  })

  it('still enqueues a member who may enter but has never been pushed', async () => {
    const { useCase } = build([
      makeContext({
        nextDueDate: day('2026-02-15'),
        subject: makeSubject({
          provisioned_at: null,
          synced_device_serials: [],
          last_synced_valid_from: null,
          last_synced_valid_to: null,
        }),
      }),
    ])

    expect((await useCase.execute({ today: TODAY })).membersEnqueued).toBe(1)
  })

  it('still enqueues an impossible state rather than assuming it away', async () => {
    // Serials without a provisioning timestamp should not exist. If it ever
    // does, the member is on a reader and may not enter, so the conservative
    // answer is to queue the work rather than to declare there is none.
    const { useCase } = build([
      makeContext({
        status: MemberStatus.Suspended,
        subject: makeSubject({
          provisioned_at: null,
          synced_device_serials: ['SER-001'],
          last_synced_blocked: null,
        }),
      }),
    ])

    const summary = await useCase.execute({ today: TODAY })

    expect(summary.membersEnqueued).toBe(1)
    expect(summary.membersNothingToDo).toBe(0)
  })

  it('keeps a divergence loud: the vendor holds someone we think was never provisioned', async () => {
    // Silence is the worse failure here. Our record says this member was never
    // pushed; the vendor is holding them. That is the Y1 shape — our record and
    // the hardware having parted company — and it must not be filed under
    // "nothing to do" just because today's sync cannot fix it on its own.
    const { repo, useCase } = build(
      [nothingToDo()],
      [
        {
          subjectId: '100001',
          name: 'Test Member',
          areaId: 1,
          templateCount: null,
          validFrom: '20251215',
          validTo: '20260115',
          syncedToVendor: true,
          deleted: false,
        },
      ]
    )

    const summary = await useCase.execute({ today: TODAY })

    expect(summary.membersNothingToDo).toBe(0)
    expect(summary.vendorDrift).toBe(1)
    expect(repo.enqueued).toHaveLength(1)
  })
})
