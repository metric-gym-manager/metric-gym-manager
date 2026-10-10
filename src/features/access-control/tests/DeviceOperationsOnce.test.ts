/**
 * A queued door open or restart runs at most once (remote day, F-11).
 *
 * Every other job is safe to repeat: it re-derives from current state and the
 * commands are idempotent. A door open and a restart are not. If a worker dies
 * after the vendor accepted the call, the stale-job reclaim hands the job back
 * and the next run would open the door — or restart the reader — again, ten
 * minutes late, for nobody. A door opened ten minutes late is worse than a
 * door not opened, so any run past the first is dead-lettered with a plain
 * message and never dispatched.
 */

import { DrainAccessSyncQueue } from '@/features/access-control/services/DrainAccessSyncQueue'
import { SyncMemberAccess } from '@/features/access-control/services/SyncMemberAccess'
import { OperateDevice } from '@/features/access-control/services/OperateDevice'
import { EvictInactiveSubjects } from '@/features/access-control/services/EvictInactiveSubjects'
import {
  AccessIntent,
  AccessSyncStatus,
} from '@/features/access-control/config/AccessControlConfig'
import { MockAccessControlProvider } from '@/lib/access-control'
import {
  FakeAccessControlRepository,
  day,
  makeDevice,
  makeJob,
  testCredentials,
} from './fakes'

function build(
  intent: AccessIntent,
  attempts: number,
  payload: Record<string, unknown> = {}
) {
  const repo = new FakeAccessControlRepository({
    credentials: testCredentials,
    devices: [makeDevice({ id: 'device-1' })],
    claimable: [
      makeJob({
        id: 'job-1',
        member_id: null,
        intent,
        attempts,
        status: AccessSyncStatus.InFlight,
        payload: { deviceId: 'device-1', actorId: 'user-1', ...payload },
      }),
    ],
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

const run = (drain: DrainAccessSyncQueue) =>
  drain.execute({ today: day('2026-10-10') })

describe('DrainAccessSyncQueue — door opens and restarts run once (F-11)', () => {
  it('does not restart a reader on a second attempt, and does not ask for attention', async () => {
    const { repo, provider, drain } = build(AccessIntent.RebootDevice, 2)

    const summary = await run(drain)

    expect(provider.getCommandsOfType('rebootDevice')).toHaveLength(0)
    expect(summary.deadLettered).toBe(1)
    expect(summary.needingAttention).toBe(0)
    expect(summary.retrying).toBe(0)
    expect(repo.settled).toEqual([
      expect.objectContaining({
        jobId: 'job-1',
        outcome: 'failed',
        retryable: false,
        error: expect.stringContaining('never sent again'),
      }),
    ])
  })

  it('does not open a door on a second attempt', async () => {
    const { provider, drain } = build(AccessIntent.OpenDoor, 2)

    const summary = await run(drain)

    expect(provider.getCommandsOfType('openDoor')).toHaveLength(0)
    expect(summary.deadLettered).toBe(1)
  })

  it('still sends a restart on the first attempt', async () => {
    const { provider, drain } = build(AccessIntent.RebootDevice, 1)

    const summary = await run(drain)

    expect(provider.getCommandsOfType('rebootDevice')).toHaveLength(1)
    expect(summary.succeeded).toBe(1)
  })

  it('still sends a door open on the first attempt', async () => {
    const { provider, drain } = build(AccessIntent.OpenDoor, 1)

    await run(drain)

    expect(provider.getCommandsOfType('openDoor')).toHaveLength(1)
  })

  it('leaves the inline-dispatched audit row alone on any attempt', async () => {
    const { provider, drain } = build(AccessIntent.OpenDoor, 3, {
      dispatchedInline: true,
    })

    const summary = await run(drain)

    // Already sent at request time: nothing to repeat and nothing to refuse.
    expect(provider.getCommands()).toHaveLength(0)
    expect(summary.succeeded).toBe(1)
    expect(summary.deadLettered).toBe(0)
  })
})
