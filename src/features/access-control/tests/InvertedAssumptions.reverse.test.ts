/**
 * Inverted-assumption simulation.
 *
 * The forward suites all ask "does the code do what it was written to do?".
 * This one asks the opposite question: **take every assumption the design
 * rests on, negate it, and replay the flow.** Anything that only works while
 * an unstated assumption holds shows up here rather than at a gym's front
 * door.
 *
 * The assumptions being inverted, in order:
 *
 *  1. A gym has exactly one reader, and always did.
 *  2. Time only moves forward — a paid-through date never retreats.
 *  3. Membership goes Active → Expired once, not in circles.
 *  4. A gym that has access control keeps the plan that entitles it.
 *  5. A member whose sync fails is visibly broken.
 *  6. Scans reach us promptly, so receipt time ≈ scan time.
 *  7. Every scan we resolve to a member stays attributed to them.
 *
 * These are simulations, not unit tests: each one plays a sequence of real
 * operations against the real code and asserts on the state that results.
 */

import { SyncMemberAccess } from '@/features/access-control/services/SyncMemberAccess'
import { ReconcileMemberAccess } from '@/features/access-control/services/ReconcileMemberAccess'
import { RecordAccessEvents } from '@/features/access-control/services/RecordAccessEvents'
import { GetMemberAccessStatus } from '@/features/access-control/services/GetMemberAccessStatus'
import { MockAccessControlProvider } from '@/lib/access-control'
import { EvictInactiveSubjects } from '@/features/access-control/services/EvictInactiveSubjects'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { SaasStatus } from '@/features/subscriptions/config/SubscriptionConfig'
import {
  makeSubscription,
  mockSubscriptionRepo,
} from '@/features/subscriptions/tests/subscription-mocks'
import {
  FakeAccessControlRepository,
  day,
  makeContext,
  makeDevice,
  makeSubject,
  testCredentials,
} from './fakes'
import type { MemberAccessSubject } from '@/features/access-control/types'

const TODAY = day('2026-01-10')

/**
 * A gym whose subject state actually mutates as commands succeed.
 *
 * The plain fake records calls; this one feeds `updateSyncState` back into the
 * context, so a multi-step simulation sees the state the previous step left
 * behind. Without that, every step would start from the same fixture and no
 * sequencing bug could ever surface.
 */
function simulation(options: {
  devices?: ReturnType<typeof makeDevice>[]
  subject?: MemberAccessSubject
  status?: MemberStatus
  nextDueDate?: Date
}) {
  const state = {
    subject: options.subject ?? makeSubject(),
    status: options.status ?? MemberStatus.Active,
    nextDueDate: options.nextDueDate ?? day('2026-01-15'),
  }

  const repo = new FakeAccessControlRepository({
    credentials: testCredentials,
    devices: options.devices ?? [makeDevice()],
  })

  jest.spyOn(repo, 'getMemberAccessContext').mockImplementation(async () =>
    makeContext({
      status: state.status,
      nextDueDate: state.nextDueDate,
      subject: state.subject,
    })
  )

  jest.spyOn(repo, 'listSubjectsForReconcile').mockImplementation(async () => [
    makeContext({
      status: state.status,
      nextDueDate: state.nextDueDate,
      subject: state.subject,
    }),
  ])

  jest
    .spyOn(repo, 'updateSyncState')
    .mockImplementation(async (_id, update) => {
      state.subject = {
        ...state.subject,
        provisioned_at: update.provisioned ? '2026-01-01T00:00:00Z' : null,
        synced_device_serials: update.syncedDeviceSerials,
        on_device: update.syncedDeviceSerials.length > 0,
        last_synced_valid_from: update.validFrom,
        last_synced_valid_to: update.validTo,
        last_synced_blocked: update.blocked,
      }
    })

  const provider = new MockAccessControlProvider()
  const sync = new SyncMemberAccess(repo, provider)

  const subscriptionRepo = mockSubscriptionRepo()
  subscriptionRepo.findByGymId.mockResolvedValue(
    makeSubscription({ gymId: 'gym-1', status: SaasStatus.Active })
  )

  const reconcile = new ReconcileMemberAccess(
    repo,
    subscriptionRepo,
    new EvictInactiveSubjects(repo, provider)
  )

  return { repo, provider, sync, reconcile, state }
}

describe('Inverted assumption 1 — a gym has exactly one reader, and always did', () => {
  it('pushes the member to a reader added after they were already synced', async () => {
    // A gym opens a second entrance. Every existing member is already synced
    // to reader one; nothing about their membership changes.
    const devices = [makeDevice()]
    const sim = simulation({ devices })

    await sim.sync.execute({ memberId: 'member-1', today: TODAY })
    expect(sim.state.subject.on_device).toBe(true)

    devices.push(
      makeDevice({
        id: 'device-2',
        device_serial: 'SER-002',
        device_name: 'Side Door',
      })
    )
    sim.provider.reset()

    await sim.sync.execute({ memberId: 'member-1', today: TODAY })

    // The member must reach the new reader. If they do not, the second door
    // simply never opens for anybody who joined before it was installed — and
    // nothing anywhere reports a problem.
    const pushes = sim.provider
      .getCommandsOfType('syncSubjectsToDevice')
      .map((c) => c.deviceSerial)

    expect(pushes).toContain('SER-002')
  })

  it('gives the new reader a validity window, not just a template', async () => {
    const devices = [makeDevice()]
    const sim = simulation({ devices })

    await sim.sync.execute({ memberId: 'member-1', today: TODAY })

    devices.push(makeDevice({ id: 'device-2', device_serial: 'SER-002' }))
    sim.provider.reset()

    await sim.sync.execute({ memberId: 'member-1', today: TODAY })

    // A template with no window is a member refused at a door our records call
    // open — the exact failure the onDevice flag was added to prevent.
    const windows = sim.provider
      .getCommandsOfType('setValidPeriod')
      .map((c) => c.deviceSerial)

    expect(windows).toContain('SER-002')
  })
})

describe('Inverted assumption 2 — a paid-through date never retreats', () => {
  it('tightens the window when a due date is corrected backwards', async () => {
    // A refund, or a mis-keyed renewal being fixed. The member is still
    // active, but paid through an earlier date than the reader was told.
    const sim = simulation({ nextDueDate: day('2026-03-15') })

    await sim.sync.execute({ memberId: 'member-1', today: TODAY })
    expect(sim.state.subject.last_synced_valid_to).toBe('20260315')

    sim.state.nextDueDate = day('2026-01-20')
    sim.provider.reset()

    await sim.sync.execute({ memberId: 'member-1', today: TODAY })

    const windows = sim.provider.getCommandsOfType('setValidPeriod')
    expect(windows).toHaveLength(1)
    expect(windows[0].details).toMatchObject({ endDate: '20260120' })
  })

  it('blocks when the corrected date is already in the past', async () => {
    const sim = simulation({ nextDueDate: day('2026-03-15') })

    await sim.sync.execute({ memberId: 'member-1', today: TODAY })

    sim.state.nextDueDate = day('2026-01-05')
    sim.provider.reset()

    await sim.sync.execute({ memberId: 'member-1', today: TODAY })

    expect(sim.provider.getCommandsOfType('blockAccess')).toHaveLength(1)
    // The invariant from AccessCommands: a blocked subject is never handed a
    // window, because a later property write can reset the block.
    expect(sim.provider.getCommandsOfType('setValidPeriod')).toHaveLength(0)
  })
})

describe('Inverted assumption 3 — membership goes Active → Expired once', () => {
  it('survives a cancel → rejoin → cancel → rejoin cycle without losing the template', async () => {
    const sim = simulation({})

    // Initial sync.
    await sim.sync.execute({ memberId: 'member-1', today: TODAY })

    for (let cycle = 0; cycle < 2; cycle++) {
      sim.provider.reset()
      sim.state.status = MemberStatus.Cancelled
      await sim.sync.execute({ memberId: 'member-1', today: TODAY })

      // Never a full removal: that would destroy the vendor's central copy and
      // silently lock out a member who rejoins.
      expect(sim.provider.getCommandsOfType('removeSubject')).toHaveLength(0)
      expect(sim.provider.getCommandsOfType('revokeBiometrics')).toHaveLength(1)
      expect(sim.state.subject.on_device).toBe(false)

      sim.provider.reset()
      sim.state.status = MemberStatus.Active
      sim.state.nextDueDate = day('2026-02-15')
      await sim.sync.execute({ memberId: 'member-1', today: TODAY })

      // Restored by re-sync alone — the member never returns to the scanner.
      expect(
        sim.provider.getCommandsOfType('syncSubjectsToDevice')
      ).toHaveLength(1)
      expect(sim.provider.getCommandsOfType('grantAccess')).toHaveLength(1)
      expect(sim.provider.getCommandsOfType('setValidPeriod')).toHaveLength(1)
      expect(sim.state.subject.on_device).toBe(true)
      expect(sim.state.subject.last_synced_blocked).toBe(false)
    }
  })

  it('settles: a second reconcile after a completed sync enqueues nothing', async () => {
    const sim = simulation({})

    await sim.sync.execute({ memberId: 'member-1', today: TODAY })

    const summary = await sim.reconcile.execute({ today: TODAY })

    // If the diff and what the sync records disagree, the reconciler re-enqueues
    // every member every night forever — one vendor call each, for no change.
    expect(summary.membersEnqueued).toBe(0)
  })

  it('settles after a block, too', async () => {
    const sim = simulation({ status: MemberStatus.Suspended })

    await sim.sync.execute({ memberId: 'member-1', today: TODAY })
    const summary = await sim.reconcile.execute({ today: TODAY })

    expect(summary.membersEnqueued).toBe(0)
  })

  it('settles after a cancellation, too', async () => {
    const sim = simulation({ status: MemberStatus.Cancelled })

    await sim.sync.execute({ memberId: 'member-1', today: TODAY })
    const summary = await sim.reconcile.execute({ today: TODAY })

    expect(summary.membersEnqueued).toBe(0)
  })
})

describe('Inverted assumption 4 — an entitled gym stays entitled', () => {
  it('stops syncing hardware for a gym that has dropped off Enterprise', async () => {
    const repo = new FakeAccessControlRepository({
      credentials: testCredentials,
      devices: [makeDevice()],
      gymsWithAccessControl: ['gym-1'],
      contexts: [
        makeContext({
          subject: makeSubject({ last_synced_blocked: true }),
        }),
      ],
    })

    const subscriptionRepo = mockSubscriptionRepo()
    subscriptionRepo.findByGymId.mockResolvedValue(
      // Paid up, in good standing — but on a tier that does not include door
      // hardware. The routes refuse this gym; the cron must not quietly grant
      // what the API denies.
      makeSubscription({
        gymId: 'gym-1',
        status: SaasStatus.Active,
        tier: 'pro' as never,
      })
    )

    const summary = await new ReconcileMemberAccess(
      repo,
      subscriptionRepo,
      new EvictInactiveSubjects(repo, new MockAccessControlProvider())
    ).execute({ today: TODAY })

    expect(summary.membersEnqueued).toBe(0)
    expect(repo.enqueued).toHaveLength(0)
  })
})

describe('Inverted assumption 5 — a member whose sync fails is visibly broken', () => {
  it('tells the front desk when a member’s access could not be applied', async () => {
    const repo = new FakeAccessControlRepository({
      credentials: testCredentials,
      devices: [makeDevice()],
      contexts: [makeContext()],
      deadJobs: 1,
    })

    const status = await new GetMemberAccessStatus(repo).execute(
      'gym-1',
      'member-1',
      TODAY
    )

    // Pending is not failure — but neither is failure "fine". A member whose
    // job burned its retry budget reads as allowed with nothing queued, so the
    // desk sees a green tick while the door stays shut.
    expect(status?.syncFailed).toBe(true)
  })

  it('does not cry failure for a member who is merely queued', async () => {
    const repo = new FakeAccessControlRepository({
      credentials: testCredentials,
      devices: [makeDevice()],
      contexts: [makeContext()],
      pendingJobs: 1,
    })

    const status = await new GetMemberAccessStatus(repo).execute(
      'gym-1',
      'member-1',
      TODAY
    )

    expect(status?.syncPending).toBe(true)
    expect(status?.syncFailed).toBe(false)
  })
})

describe('Inverted assumption 6 — scans reach us promptly', () => {
  it('does not report drift for a batch that was merely delivered late', async () => {
    const repo = new FakeAccessControlRepository({
      devices: [makeDevice({ timezone_offset_minutes: 0 })],
    })

    // A reader batching a busy morning: the oldest scan is an hour old, the
    // newest is seconds old. The clock is perfectly correct.
    const events = [
      { EmpId: '100001', AttTime: '2026-01-10 08:00:00', DeviceID: 'SER-001' },
      { EmpId: '100002', AttTime: '2026-01-10 08:30:00', DeviceID: 'SER-001' },
      { EmpId: '100003', AttTime: '2026-01-10 09:00:00', DeviceID: 'SER-001' },
    ]

    const summary = await new RecordAccessEvents(repo).execute(
      events,
      new Date('2026-01-10T09:00:05Z')
    )

    // Judging drift from the oldest scan in a batch makes every batching
    // reader look broken, which trains operators to ignore the one signal we
    // have about the clock the lockout is enforced against.
    expect(summary.driftingDevices).toEqual([])
    expect(repo.clockSkews[0]?.skewSeconds).toBeGreaterThan(-60)
  })

  it('still reports a genuinely wrong clock', async () => {
    const repo = new FakeAccessControlRepository({
      devices: [makeDevice({ timezone_offset_minutes: 0 })],
    })

    const summary = await new RecordAccessEvents(repo).execute(
      [
        {
          EmpId: '100001',
          AttTime: '2026-01-10 12:00:00',
          DeviceID: 'SER-001',
        },
      ],
      // Reader thinks it is three hours later than it is.
      new Date('2026-01-10T09:00:00Z')
    )

    expect(summary.driftingDevices).toEqual(['SER-001'])
  })
})

describe('Inverted assumption 7 — a resolved scan stays attributed', () => {
  it('stores the member on the event, not only inside the raw payload', async () => {
    const repo = new FakeAccessControlRepository({
      devices: [makeDevice()],
      contexts: [
        makeContext({
          memberId: 'member-1',
          subject: makeSubject({ subject_id: 100001 }),
        }),
      ],
    })

    await new RecordAccessEvents(repo).execute([
      { EmpId: '100001', AttTime: '2026-01-10 12:00:00', DeviceID: 'SER-001' },
    ])

    // The check-in log filters by member and the serializer reads memberId. If
    // the resolved member only lands in `raw`, both are permanently empty and
    // "show me this member's entries" can never answer.
    expect(repo.storedEvents[0]?.memberId).toBe('member-1')
  })
})
