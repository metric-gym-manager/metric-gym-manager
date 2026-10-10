/**
 * Restarting a reader queues a re-seat of the members it holds (visit 1, D1).
 *
 * On visit 1 a ZAM70 restarted through the vendor kept its users and dropped
 * their fingerprints, and neither a forced re-push nor waiting restored them
 * (PH-15). A re-seat does. So a restart issued through our app queues one for
 * every member that reader holds, due 180 s later when the reader is back.
 */

import { OperateDevice } from '@/features/access-control/services/OperateDevice'
import {
  AccessIntent,
  REBOOT_RESEAT_DELAY_SECONDS,
} from '@/features/access-control/config/AccessControlConfig'
import { MockAccessControlProvider } from '@/lib/access-control'
import {
  FakeAccessControlRepository,
  makeContext,
  makeDevice,
  makeSubject,
  testCredentials,
} from './fakes'

const GYM = 'gym-1'

function holder(memberId: string, serials: string[]) {
  return makeContext({
    memberId,
    subject: makeSubject({
      id: `row-${memberId}`,
      member_id: memberId,
      synced_device_serials: serials,
    }),
  })
}

function setup() {
  const repo = new FakeAccessControlRepository({
    credentials: testCredentials,
    devices: [
      makeDevice({ id: 'device-A', device_serial: 'A' }),
      makeDevice({ id: 'device-B', device_serial: 'B' }),
    ],
    contexts: [
      holder('m1', ['A', 'B']),
      holder('m2', ['A']),
      holder('m3', ['B']),
    ],
  })
  const provider = new MockAccessControlProvider()
  return { repo, provider, service: new OperateDevice(repo, provider) }
}

const repairs = (repo: FakeAccessControlRepository) =>
  repo.enqueued.filter((job) => job.intent === AccessIntent.ReconcileMember)

describe('OperateDevice — repair after a restart (visit 1, D1)', () => {
  it('queues a delayed re-seat for each member the restarted reader holds, and no other', async () => {
    const { repo, service } = setup()
    const before = Date.now()

    const result = await service.reboot({
      gymId: GYM,
      deviceId: 'device-A',
      actorId: 'user-1',
    })

    expect(result).toEqual({
      applicable: true,
      dispatched: true,
      membersQueuedForRepair: 2,
    })

    const jobs = repairs(repo)
    expect(jobs.map((j) => j.memberId).sort()).toEqual(['m1', 'm2'])
    for (const job of jobs) {
      expect(job.payload).toEqual({
        reason: 'reader_restarted',
        reseat: true,
        deviceSerial: 'A',
      })
      expect(job.notBefore!.getTime()).toBeGreaterThanOrEqual(
        before + (REBOOT_RESEAT_DELAY_SECONDS - 1) * 1000
      )
    }
  })

  it('queues nothing for a door opening', async () => {
    const { repo, service } = setup()

    const result = await service.openDoor({
      gymId: GYM,
      deviceId: 'device-A',
      actorId: 'user-1',
    })

    expect(result.membersQueuedForRepair).toBeUndefined()
    expect(repairs(repo)).toHaveLength(0)
    // The audit row the request writes is still there.
    expect(repo.enqueued.map((j) => j.intent)).toEqual([AccessIntent.OpenDoor])
  })

  it('queues nothing when the vendor refuses the restart', async () => {
    const { repo, provider, service } = setup()
    jest.spyOn(provider, 'rebootDevice').mockResolvedValueOnce({
      status: 'failed',
      error: 'Vendor returned status 502',
      retryable: true,
    })

    const result = await service.reboot({
      gymId: GYM,
      deviceId: 'device-A',
      actorId: 'user-1',
    })

    expect(result.dispatched).toBe(false)
    expect(repairs(repo)).toHaveLength(0)
  })

  it('still reports the restart as dispatched when the repair cannot be queued', async () => {
    const { repo, service } = setup()
    jest.spyOn(repo, 'enqueueMany').mockRejectedValueOnce(new Error('db down'))
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    const result = await service.reboot({
      gymId: GYM,
      deviceId: 'device-A',
      actorId: 'user-1',
    })

    expect(result).toEqual({
      applicable: true,
      dispatched: true,
      membersQueuedForRepair: 0,
    })
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })
})
