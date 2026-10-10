/**
 * A job's result is only recorded by the attempt that claimed it (remote day,
 * F-10).
 *
 * `reclaim_stale_access_sync_jobs` hands a job whose worker looks dead back to
 * `pending`, and the next claim bumps `attempts`. If the first worker was only
 * slow, it still finishes and used to write its result over the new run — and
 * a write that matches no row reports success. So a result is now written only
 * `WHERE status = 'in_flight' AND attempts = <the attempt we claimed>`, and a
 * write that applied to nothing is counted as superseded rather than as
 * success.
 */

import { DrainAccessSyncQueue } from '@/features/access-control/services/DrainAccessSyncQueue'
import { SyncMemberAccess } from '@/features/access-control/services/SyncMemberAccess'
import { OperateDevice } from '@/features/access-control/services/OperateDevice'
import { EvictInactiveSubjects } from '@/features/access-control/services/EvictInactiveSubjects'
import { AccessSyncStatus } from '@/features/access-control/config/AccessControlConfig'
import { MockAccessControlProvider } from '@/lib/access-control'
import {
  FakeAccessControlRepository,
  day,
  makeContext,
  makeDevice,
  makeJob,
  testCredentials,
} from './fakes'

function build(provider = new MockAccessControlProvider()) {
  const repo = new FakeAccessControlRepository({
    credentials: testCredentials,
    devices: [makeDevice()],
    deviceSerials: ['SER-001'],
    contexts: [makeContext()],
    claimable: [makeJob({ id: 'job-1', attempts: 2 })],
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

describe('DrainAccessSyncQueue — results guarded by the claimed attempt (F-10)', () => {
  it('counts a normal run as succeeded and nothing as superseded', async () => {
    const { repo, drain } = build()

    const summary = await drain.execute({ today: day('2026-10-10') })

    expect(summary.succeeded).toBe(1)
    expect(summary.superseded).toBe(0)
    expect(repo.jobState('job-1')).toEqual({
      status: AccessSyncStatus.Succeeded,
      attempts: 2,
    })
  })

  it('drops the result of a job a reclaim handed to another run mid-flight', async () => {
    const provider = new MockAccessControlProvider()
    const { repo, drain } = build(provider)

    // The reclaim lands while this worker is still talking to the vendor: the
    // job goes back to pending, and nobody has claimed it again yet.
    const real = provider.setValidPeriod.bind(provider)
    jest
      .spyOn(provider, 'setValidPeriod')
      .mockImplementationOnce(async (...args) => {
        repo.simulateReclaim('job-1')
        return real(...args)
      })

    const summary = await drain.execute({ today: day('2026-10-10') })

    expect(summary.succeeded).toBe(0)
    expect(summary.superseded).toBe(1)
    // The other run's job is untouched, not overwritten as succeeded.
    expect(repo.jobState('job-1')).toEqual({
      status: AccessSyncStatus.Pending,
      attempts: 2,
    })
  })

  it('drops the result when another run has already re-claimed the job', async () => {
    const provider = new MockAccessControlProvider()
    const { repo, drain } = build(provider)

    // Back in flight, but at the new attempt: only the attempt number says the
    // job is no longer ours.
    const real = provider.setValidPeriod.bind(provider)
    jest
      .spyOn(provider, 'setValidPeriod')
      .mockImplementationOnce(async (...args) => {
        repo.simulateReclaim('job-1', { claimedAgain: true })
        return real(...args)
      })

    const summary = await drain.execute({ today: day('2026-10-10') })

    expect(summary.succeeded).toBe(0)
    expect(summary.superseded).toBe(1)
    expect(repo.jobState('job-1')).toEqual({
      status: AccessSyncStatus.InFlight,
      attempts: 3,
    })
  })

  it('drops a retryable failure the same way, counting it as neither retrying nor dead', async () => {
    const provider = new MockAccessControlProvider()
    const { repo, drain } = build(provider)

    jest.spyOn(provider, 'setValidPeriod').mockImplementationOnce(async () => {
      repo.simulateReclaim('job-1')
      return {
        status: 'failed' as const,
        error: 'Vendor returned status 503',
        retryable: true,
      }
    })

    const summary = await drain.execute({ today: day('2026-10-10') })

    expect(summary.superseded).toBe(1)
    expect(summary.retrying).toBe(0)
    expect(summary.deadLettered).toBe(0)
    expect(repo.jobState('job-1')?.status).toBe(AccessSyncStatus.Pending)
  })

  it('drops a permanent failure the same way, without calling it needing attention', async () => {
    const provider = new MockAccessControlProvider()
    const { repo, drain } = build(provider)

    jest.spyOn(provider, 'setValidPeriod').mockImplementationOnce(async () => {
      repo.simulateReclaim('job-1')
      return {
        status: 'failed' as const,
        error: 'Bad request',
        retryable: false,
        needsAttention: true,
      }
    })

    const summary = await drain.execute({ today: day('2026-10-10') })

    expect(summary.superseded).toBe(1)
    expect(summary.deadLettered).toBe(0)
    expect(summary.needingAttention).toBe(0)
  })
})
