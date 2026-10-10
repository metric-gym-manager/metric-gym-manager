/**
 * Outbox jobs that carry force / re-seat, and jobs that wait (visit 1, D1).
 *
 * The restart repair is a re-seat queued 180 s ahead for every member a reader
 * holds. That only works if the drain reads `reseat` and `force` out of the
 * job's payload (it used to call SyncMemberAccess with neither) and if a job
 * enqueued for later is not claimed early.
 */

import { DrainAccessSyncQueue } from '@/features/access-control/services/DrainAccessSyncQueue'
import { SyncMemberAccess } from '@/features/access-control/services/SyncMemberAccess'
import { OperateDevice } from '@/features/access-control/services/OperateDevice'
import { EvictInactiveSubjects } from '@/features/access-control/services/EvictInactiveSubjects'
import { MockAccessControlProvider } from '@/lib/access-control'
import { AccessIntent } from '@/features/access-control/config/AccessControlConfig'
import {
  FakeAccessControlRepository,
  day,
  makeContext,
  makeDevice,
  makeJob,
  makeSubject,
  testCredentials,
} from './fakes'

const TODAY = day('2026-10-07')

/** A member our record says readers A and B hold, window and all. */
function build(payload: Record<string, unknown>) {
  const repo = new FakeAccessControlRepository({
    credentials: testCredentials,
    devices: [makeDevice()],
    deviceSerials: ['A', 'B'],
    contexts: [
      makeContext({
        membershipStartDate: day('2026-10-03'),
        nextDueDate: day('2027-04-03'),
        subject: makeSubject({
          synced_device_serials: ['A', 'B'],
          last_synced_valid_from: '20261003',
          last_synced_valid_to: '20270403',
          last_synced_blocked: false,
        }),
      }),
    ],
    claimable: [makeJob({ payload })],
  })
  const provider = new MockAccessControlProvider()
  const drain = new DrainAccessSyncQueue(
    repo,
    new SyncMemberAccess(repo, provider),
    new OperateDevice(repo, provider),
    new EvictInactiveSubjects(repo, provider),
    provider
  )
  return { repo, provider, drain }
}

const operations = (provider: MockAccessControlProvider) =>
  provider.getCommands().map((c) => c.operation)

describe('DrainAccessSyncQueue — force and re-seat from the payload', () => {
  it('revokes before it pushes when the job says reseat', async () => {
    const { drain, provider } = build({ reseat: true })

    await drain.execute({ today: TODAY })

    const ops = operations(provider)
    expect(ops.indexOf('revokeBiometrics')).toBeGreaterThanOrEqual(0)
    expect(ops.indexOf('revokeBiometrics')).toBeLessThan(
      ops.indexOf('syncSubjectsToDevice')
    )
    expect(provider.getCommandsOfType('syncSubjectsToDevice')).toHaveLength(2)
  })

  it('re-pushes both readers, without a revoke, when the job says force', async () => {
    const { drain, provider } = build({ force: true })

    await drain.execute({ today: TODAY })

    expect(
      provider
        .getCommandsOfType('syncSubjectsToDevice')
        .map((c) => c.deviceSerial)
    ).toEqual(['A', 'B'])
    expect(provider.getCommandsOfType('revokeBiometrics')).toHaveLength(0)
  })

  it('sends nothing for an ordinary job when our record already matches', async () => {
    const { drain, provider } = build({})

    await drain.execute({ today: TODAY })

    expect(provider.getCommands()).toHaveLength(0)
  })
})

describe('DrainAccessSyncQueue — a job enqueued for later', () => {
  function queued() {
    const repo = new FakeAccessControlRepository({
      credentials: testCredentials,
      devices: [makeDevice()],
      deviceSerials: ['A', 'B'],
      contexts: [makeContext()],
    })
    const provider = new MockAccessControlProvider()
    const drain = new DrainAccessSyncQueue(
      repo,
      new SyncMemberAccess(repo, provider),
      new OperateDevice(repo, provider),
      new EvictInactiveSubjects(repo, provider),
      provider
    )
    return { repo, drain }
  }

  it('is not claimed before its time', async () => {
    const { repo, drain } = queued()
    await repo.enqueue(
      'gym-1',
      'member-1',
      AccessIntent.ReconcileMember,
      { reseat: true },
      new Date(Date.now() + 180_000)
    )

    const summary = await drain.execute({ today: TODAY })

    expect(summary.claimed).toBe(0)
  })

  it('is claimed once its time has passed', async () => {
    const { repo, drain } = queued()
    await repo.enqueue(
      'gym-1',
      'member-1',
      AccessIntent.ReconcileMember,
      { reseat: true },
      new Date(Date.now() - 1_000)
    )

    const summary = await drain.execute({ today: TODAY })

    expect(summary.claimed).toBe(1)
  })

  it('is claimed at once when no time was given', async () => {
    const { repo, drain } = queued()
    await repo.enqueue('gym-1', 'member-1', AccessIntent.ReconcileMember)

    const summary = await drain.execute({ today: TODAY })

    expect(summary.claimed).toBe(1)
  })
})
