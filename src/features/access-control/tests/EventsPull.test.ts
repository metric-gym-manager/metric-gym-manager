/**
 * An events pull is a recorded operation (visit 2, CD-2).
 *
 * `GetEventsbyDevSN` makes a reader re-deliver its stored log, and the
 * re-delivered events arrive with `AttTime` in UTC while live ones are
 * reader-local. Ingestion can only tell the two apart if it knows a pull
 * happened, so the marker job is written BEFORE the vendor is asked, with
 * `dispatchedInline: true` so the drain never sends it again.
 */

import { OperateDevice } from '@/features/access-control/services/OperateDevice'
import { DrainAccessSyncQueue } from '@/features/access-control/services/DrainAccessSyncQueue'
import { SyncMemberAccess } from '@/features/access-control/services/SyncMemberAccess'
import { EvictInactiveSubjects } from '@/features/access-control/services/EvictInactiveSubjects'
import { MockAccessControlProvider } from '@/lib/access-control'
import {
  AccessIntent,
  EVENTS_PULL_WINDOW_SECONDS,
} from '@/features/access-control/config/AccessControlConfig'
import {
  FakeAccessControlRepository,
  makeDevice,
  makeJob,
  testCredentials,
} from './fakes'

const request = { gymId: 'gym-1', deviceId: 'device-1', actorId: 'user-7' }

function build(provider = new MockAccessControlProvider()) {
  const repo = new FakeAccessControlRepository({
    credentials: testCredentials,
    devices: [makeDevice()],
  })

  return { repo, provider, useCase: new OperateDevice(repo, provider) }
}

describe('OperateDevice.requestEventsUpload', () => {
  it('writes the marker job before it calls the vendor', async () => {
    const { repo, provider, useCase } = build()
    const queuedWhenCalled: number[] = []
    const original = provider.requestEventsUpload.bind(provider)
    jest
      .spyOn(provider, 'requestEventsUpload')
      .mockImplementation(async (...args) => {
        queuedWhenCalled.push(repo.enqueued.length)
        return original(...args)
      })

    const result = await useCase.requestEventsUpload(request)

    expect(result).toEqual({ applicable: true, dispatched: true })
    // The marker already existed at the moment of the vendor call.
    expect(queuedWhenCalled).toEqual([1])
    expect(repo.enqueued[0]).toMatchObject({
      gymId: 'gym-1',
      memberId: null,
      intent: AccessIntent.EventsPull,
      payload: {
        actorId: 'user-7',
        deviceId: 'device-1',
        deviceSerial: 'SER-001',
        dispatchedInline: true,
      },
    })
  })

  it('asks the vendor for that reader and no other', async () => {
    const { provider, useCase } = build()

    await useCase.requestEventsUpload(request)

    expect(provider.getCommandsOfType('requestEventsUpload')).toEqual([
      { operation: 'requestEventsUpload', deviceSerial: 'SER-001' },
    ])
  })

  it('refuses a reader that is not this gym’s, with no marker and no vendor call', async () => {
    const { repo, provider, useCase } = build()

    const result = await useCase.requestEventsUpload({
      ...request,
      deviceId: 'another-gyms-device',
    })

    expect(result).toMatchObject({ applicable: false, dispatched: false })
    expect(repo.enqueued).toHaveLength(0)
    expect(provider.getCommands()).toHaveLength(0)
  })

  it('reports a vendor failure without pretending the pull happened', async () => {
    const { provider, useCase } = build()
    jest.spyOn(provider, 'requestEventsUpload').mockResolvedValue({
      status: 'failed',
      error: 'device offline',
      retryable: true,
    })

    const result = await useCase.requestEventsUpload(request)

    expect(result).toMatchObject({ applicable: true, dispatched: false })
  })
})

describe('the drain and an events pull marker', () => {
  function buildDrain(job: ReturnType<typeof makeJob>) {
    const provider = new MockAccessControlProvider()
    const repo = new FakeAccessControlRepository({
      credentials: testCredentials,
      devices: [makeDevice()],
      claimable: [job],
    })
    const drain = new DrainAccessSyncQueue(
      repo,
      new SyncMemberAccess(repo, provider),
      new OperateDevice(repo, provider),
      new EvictInactiveSubjects(repo, provider),
      provider
    )

    return { repo, provider, drain }
  }

  it('completes an inline marker as succeeded, with no vendor call', async () => {
    const { repo, provider, drain } = buildDrain(
      makeJob({
        intent: AccessIntent.EventsPull as never,
        member_id: null,
        payload: {
          deviceId: 'device-1',
          deviceSerial: 'SER-001',
          dispatchedInline: true,
        },
      })
    )

    const summary = await drain.execute()

    expect(summary.succeeded).toBe(1)
    expect(summary.deadLettered).toBe(0)
    expect(repo.settled[0]).toMatchObject({ outcome: 'completed' })
    expect(provider.getCommands()).toHaveLength(0)
  })

  it('never re-sends a marker that was not dispatched inline, and raises no alarm', async () => {
    const { repo, provider, drain } = buildDrain(
      makeJob({
        intent: AccessIntent.EventsPull as never,
        member_id: null,
        payload: { deviceId: 'device-1', deviceSerial: 'SER-001' },
      })
    )

    const summary = await drain.execute()

    expect(summary.needingAttention).toBe(0)
    expect(repo.settled[0]).toMatchObject({
      outcome: 'failed',
      retryable: false,
    })
    expect(provider.getCommands()).toHaveLength(0)
  })
})

describe('FakeAccessControlRepository.hasRecentEventsPull', () => {
  afterEach(() => jest.useRealTimers())

  async function markerAt(
    repo: FakeAccessControlRepository,
    serial = 'SER-001'
  ) {
    await repo.enqueue('gym-1', null, AccessIntent.EventsPull, {
      deviceSerial: serial,
      dispatchedInline: true,
    })
  }

  it('is true for a 10-minute-old marker and false for a 31-minute-old one', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-10-10T08:00:00Z'))
    const repo = new FakeAccessControlRepository({})
    await markerAt(repo)

    jest.setSystemTime(new Date('2026-10-10T08:10:00Z'))
    expect(
      await repo.hasRecentEventsPull(
        'gym-1',
        'SER-001',
        EVENTS_PULL_WINDOW_SECONDS
      )
    ).toBe(true)

    jest.setSystemTime(new Date('2026-10-10T08:31:00Z'))
    expect(
      await repo.hasRecentEventsPull(
        'gym-1',
        'SER-001',
        EVENTS_PULL_WINDOW_SECONDS
      )
    ).toBe(false)
  })

  it('is scoped to the reader and the gym', async () => {
    const repo = new FakeAccessControlRepository({})
    await markerAt(repo, 'SER-001')

    expect(await repo.hasRecentEventsPull('gym-1', 'SER-002', 1800)).toBe(false)
    expect(await repo.hasRecentEventsPull('gym-2', 'SER-001', 1800)).toBe(false)
  })

  it('does not count other kinds of job for the same reader', async () => {
    const repo = new FakeAccessControlRepository({})
    await repo.enqueue('gym-1', null, AccessIntent.RebootDevice, {
      deviceSerial: 'SER-001',
    })

    expect(await repo.hasRecentEventsPull('gym-1', 'SER-001', 1800)).toBe(false)
  })
})
