/**
 * The outbox worker.
 *
 * Three of these tests exist because of defects found while planning, and each
 * one guards a failure mode that is silent in production:
 *
 *  - **P1** — one member throwing must not abort the batch. If it does, every
 *    job already claimed stays `in_flight`, and `claim_access_sync_jobs` only
 *    picks up `pending` and `failed`. Those members never sync again and
 *    nothing reports it.
 *  - **P2** — the return-code classification must reach the settle decision. A
 *    full reader (`-18`) retried forever buries the real problem behind noise.
 *  - **P3** — a run killed mid-drain must have its jobs returned to `pending`
 *    by the next run.
 */

import { DrainAccessSyncQueue } from '@/features/access-control/services/DrainAccessSyncQueue'
import { SyncMemberAccess } from '@/features/access-control/services/SyncMemberAccess'
import { OperateDevice } from '@/features/access-control/services/OperateDevice'
import { EvictInactiveSubjects } from '@/features/access-control/services/EvictInactiveSubjects'
import { MockAccessControlProvider } from '@/lib/access-control'
import type {
  CommandOutcome,
  IAccessControlProvider,
} from '@/lib/access-control'
import { AccessSyncStatus } from '@/features/access-control/config/AccessControlConfig'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import {
  FakeAccessControlRepository,
  day,
  makeContext,
  makeDevice,
  makeJob,
  makeSubject,
  testCredentials,
  type FakeRepositoryOptions,
} from './fakes'

const TODAY = day('2026-01-10')

/**
 * A provider that fails whatever it is asked to do.
 *
 * Every write fails, not just one: which command a member needs depends on
 * their subject state, so pinning the failure to a single operation would make
 * these tests quietly stop exercising the failure path if the derivation
 * changed.
 */
class FailingProvider extends MockAccessControlProvider {
  constructor(private readonly outcome: CommandOutcome | Error) {
    super()
  }

  private fail(): Promise<CommandOutcome> {
    if (this.outcome instanceof Error) throw this.outcome
    return Promise.resolve(this.outcome)
  }

  override upsertSubject(): Promise<CommandOutcome> {
    return this.fail()
  }

  override syncSubjectsToDevice(): Promise<CommandOutcome> {
    return this.fail()
  }

  override setValidPeriod(): Promise<CommandOutcome> {
    return this.fail()
  }

  override grantAccess(): Promise<CommandOutcome> {
    return this.fail()
  }

  override blockAccess(): Promise<CommandOutcome> {
    return this.fail()
  }

  override revokeBiometrics(): Promise<CommandOutcome> {
    return this.fail()
  }
}

function build(
  options: FakeRepositoryOptions,
  provider: IAccessControlProvider = new MockAccessControlProvider()
) {
  const repo = new FakeAccessControlRepository({
    credentials: testCredentials,
    devices: [makeDevice()],
    ...options,
  })

  const drain = new DrainAccessSyncQueue(
    repo,
    new SyncMemberAccess(repo, provider),
    new OperateDevice(repo, provider),
    new EvictInactiveSubjects(repo, provider),
    provider
  )

  return { repo, drain, provider }
}

describe('DrainAccessSyncQueue', () => {
  describe('batch isolation (P1)', () => {
    it('finishes the batch when one member throws', async () => {
      const repo = new FakeAccessControlRepository({
        credentials: testCredentials,
        devices: [makeDevice()],
        contexts: [
          makeContext({ memberId: 'member-good' }),
          makeContext({ memberId: 'member-bad' }),
        ],
        claimable: [
          makeJob({ id: 'job-bad', member_id: 'member-bad' }),
          makeJob({ id: 'job-good', member_id: 'member-good' }),
        ],
      })

      // Throwing from the repository escapes SyncMemberAccess entirely, which
      // is the harsher case: only the drainer's own guard can contain it.
      const original = repo.getMemberAccessContext.bind(repo)
      jest
        .spyOn(repo, 'getMemberAccessContext')
        .mockImplementation(async (memberId: string) => {
          if (memberId === 'member-bad') throw new Error('database exploded')
          return original(memberId)
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

      expect(summary.claimed).toBe(2)
      // Both jobs reached a terminal state — neither was left in_flight.
      expect(repo.settled).toHaveLength(2)
      expect(repo.settled.map((s) => s.jobId).sort()).toEqual([
        'job-bad',
        'job-good',
      ])
      expect(summary.errors).toContain('database exploded')
    })

    it('reschedules the member whose sync threw, rather than dropping them', async () => {
      const { repo, drain } = build(
        {
          contexts: [makeContext()],
          claimable: [makeJob()],
        },
        new FailingProvider(new Error('socket hang up'))
      )

      await drain.execute({ today: TODAY })

      // The throw was converted to a retryable failure inside SyncMemberAccess,
      // so the job comes back rather than dying.
      expect(repo.settled[0]).toMatchObject({
        outcome: 'failed',
        retryable: true,
      })
    })
  })

  describe('failure classification (P2)', () => {
    it('reschedules a transient failure', async () => {
      const { repo, drain } = build(
        {
          contexts: [
            makeContext({ subject: makeSubject({ on_device: false }) }),
          ],
          claimable: [makeJob()],
        },
        new FailingProvider({
          status: 'failed',
          error: 'No response from device',
          retryable: true,
          returnCode: -1,
        })
      )

      const summary = await drain.execute({ today: TODAY })

      expect(summary.retrying).toBe(1)
      expect(summary.deadLettered).toBe(0)
      expect(repo.settled[0]).toMatchObject({
        outcome: 'failed',
        retryable: true,
      })
    })

    it('dead-letters a permanent failure instead of retrying forever', async () => {
      const { repo, drain } = build(
        {
          contexts: [
            makeContext({ subject: makeSubject({ on_device: false }) }),
          ],
          claimable: [makeJob()],
        },
        new FailingProvider({
          status: 'failed',
          error: 'Command not supported',
          retryable: false,
          returnCode: -708,
        })
      )

      const summary = await drain.execute({ today: TODAY })

      expect(summary.deadLettered).toBe(1)
      expect(summary.retrying).toBe(0)
      expect(repo.settled[0]).toMatchObject({ retryable: false })
    })

    it('dead-letters and flags a full reader, which no amount of retrying fixes', async () => {
      const { drain } = build(
        {
          contexts: [
            makeContext({ subject: makeSubject({ on_device: false }) }),
          ],
          claimable: [makeJob()],
        },
        new FailingProvider({
          status: 'failed',
          error: 'Device storage full',
          // Retryable on its own terms, but a person has to free capacity —
          // needsAttention must win, or this retries until the budget is gone.
          retryable: true,
          needsAttention: true,
          returnCode: -18,
        })
      )

      const summary = await drain.execute({ today: TODAY })

      expect(summary.deadLettered).toBe(1)
      expect(summary.needingAttention).toBe(1)
      expect(summary.retrying).toBe(0)
    })
  })

  describe('stale job reclamation (P3)', () => {
    it('reclaims before claiming, so a killed run heals on the next pass', async () => {
      const { repo, drain } = build({ staleJobs: 3, claimable: [] })
      const order: string[] = []

      jest.spyOn(repo, 'reclaimStaleJobs').mockImplementation(async () => {
        order.push('reclaim')
        return 3
      })
      jest.spyOn(repo, 'claimDueJobs').mockImplementation(async () => {
        order.push('claim')
        return []
      })

      const summary = await drain.execute()

      expect(summary.reclaimed).toBe(3)
      expect(order).toEqual(['reclaim', 'claim'])
    })
  })

  describe('routing', () => {
    it('marks a successful member sync succeeded', async () => {
      const { repo, drain } = build({
        contexts: [makeContext({ subject: makeSubject({ on_device: false }) })],
        claimable: [makeJob()],
      })

      const summary = await drain.execute({ today: TODAY })

      expect(summary.succeeded).toBe(1)
      expect(repo.settled[0]).toEqual({
        jobId: 'job-1',
        outcome: 'completed',
        status: AccessSyncStatus.Succeeded,
      })
    })

    it('does not re-send a device operation that already dispatched inline', async () => {
      const { drain, provider } = build({
        claimable: [
          makeJob({
            intent: 'open_door' as never,
            member_id: null,
            payload: { deviceId: 'device-1', dispatchedInline: true },
          }),
        ],
      })

      const summary = await drain.execute()

      expect(summary.succeeded).toBe(1)
      expect(
        (provider as MockAccessControlProvider).getCommandsOfType('openDoor')
      ).toHaveLength(0)
    })

    it('dead-letters a member job that carries no member', async () => {
      const { repo, drain } = build({
        claimable: [
          makeJob({ member_id: null, intent: 'reconcile_member' as never }),
        ],
      })

      const summary = await drain.execute()

      expect(summary.deadLettered).toBe(1)
      expect(summary.needingAttention).toBe(1)
      expect(repo.settled[0]).toMatchObject({ retryable: false })
    })

    it('treats an unconfigured gym as done, not as a failure', async () => {
      // No credentials: the gym has not set up access control, so there is
      // nothing to send and nothing has gone wrong.
      const { repo, drain } = build({
        credentials: null,
        contexts: [makeContext()],
        claimable: [makeJob()],
      })

      const summary = await drain.execute({ today: TODAY })

      expect(summary.succeeded).toBe(1)
      expect(repo.settled[0]?.outcome).toBe('completed')
    })
  })

  describe('pacing', () => {
    it('spaces provider calls across a batch', async () => {
      const jobs = [1, 2, 3].map((n) =>
        makeJob({ id: `job-${n}`, member_id: `member-${n}` })
      )

      const { drain } = build({
        contexts: jobs.map((job) =>
          makeContext({
            memberId: job.member_id as string,
            status: MemberStatus.Active,
            subject: makeSubject({ on_device: false }),
          })
        ),
        claimable: jobs,
      })

      const started = Date.now()
      const summary = await drain.execute({ today: TODAY })
      const elapsed = Date.now() - started

      expect(summary.claimed).toBe(3)
      // Three jobs at five per second is at least two gaps of 200ms. Asserting
      // a floor rather than a window keeps this from flaking on a slow runner.
      expect(elapsed).toBeGreaterThanOrEqual(350)
    })
  })
})
