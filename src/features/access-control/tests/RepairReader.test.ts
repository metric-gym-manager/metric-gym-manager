/**
 * "Repair fingerprints" on a reader (visit 2, RB-1 stopgap / DEC2-09).
 *
 * After a power cut only a re-seat restored fingers (PH-26), and a re-seat
 * queued while the reader was still offline destroyed a finger added there
 * (PH-25). So the button queues a re-seat of every member the reader holds,
 * 60 s later, and its dialog tells the gym to wait until the reader has been
 * back on for a minute.
 */

import { OperateDevice } from '@/features/access-control/services/OperateDevice'
import {
  AccessIntent,
  MANUAL_REPAIR_DELAY_SECONDS,
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

function setup(credentials: typeof testCredentials | null = testCredentials) {
  const repo = new FakeAccessControlRepository({
    credentials,
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

const request = { gymId: GYM, deviceId: 'device-A', actorId: 'user-1' }

describe('OperateDevice.repairReader', () => {
  it('queues one re-seat per member the reader holds, 60 s from now, and none for the other reader', async () => {
    const { repo, service } = setup()
    const before = Date.now()

    const result = await service.repairReader(request)

    expect(result).toEqual({ applicable: true, membersQueued: 2 })

    const jobs = repo.enqueued.filter(
      (job) => job.intent === AccessIntent.ReconcileMember
    )
    expect(jobs.map((j) => j.memberId).sort()).toEqual(['m1', 'm2'])
    for (const job of jobs) {
      expect(job.payload).toEqual({
        reason: 'reader_repair_requested',
        reseat: true,
        deviceSerial: 'A',
        actorId: 'user-1',
      })
      expect(job.notBefore!.getTime()).toBeGreaterThanOrEqual(
        before + (MANUAL_REPAIR_DELAY_SECONDS - 1) * 1000
      )
    }
  })

  it('talks to no reader itself', async () => {
    const { provider, service } = setup()

    await service.repairReader(request)

    expect(provider.getCommands()).toHaveLength(0)
  })

  it('reports an unknown reader as not applicable and queues nothing', async () => {
    const { repo, service } = setup()

    const result = await service.repairReader({
      ...request,
      deviceId: 'another-gyms-device',
    })

    expect(result).toEqual({
      applicable: false,
      membersQueued: 0,
      error: 'Device not found for this gym',
    })
    expect(repo.enqueued).toHaveLength(0)
  })

  it('is not applicable for a gym with no access control', async () => {
    const { repo, service } = setup(null)

    const result = await service.repairReader(request)

    expect(result).toEqual({ applicable: false, membersQueued: 0 })
    expect(repo.enqueued).toHaveLength(0)
  })

  it('queues nothing, and says so, for a reader that holds nobody', async () => {
    const repo = new FakeAccessControlRepository({
      credentials: testCredentials,
      devices: [makeDevice({ id: 'device-A', device_serial: 'A' })],
      contexts: [],
    })

    const result = await new OperateDevice(
      repo,
      new MockAccessControlProvider()
    ).repairReader(request)

    expect(result).toEqual({ applicable: true, membersQueued: 0 })
    expect(repo.enqueued).toHaveLength(0)
  })
})
