/**
 * A rejected VFT sign-in reaches the gym owner (remote day, F-03).
 *
 * The jobs are what discover that the account no longer works, so they are what
 * must say so. A rejected sign-in dead-letters the job as needing attention
 * AND clears the gym's stored confirmation, which is the state the settings
 * card already renders as "verification failed". Before this, a gym with a
 * changed vendor password showed Connected while every job died unflagged.
 */

import { DrainAccessSyncQueue } from '@/features/access-control/services/DrainAccessSyncQueue'
import { SyncMemberAccess } from '@/features/access-control/services/SyncMemberAccess'
import { OperateDevice } from '@/features/access-control/services/OperateDevice'
import { EvictInactiveSubjects } from '@/features/access-control/services/EvictInactiveSubjects'
import { MockAccessControlProvider } from '@/lib/access-control'
import type { CommandOutcome } from '@/lib/access-control'
import {
  FakeAccessControlRepository,
  day,
  makeContext,
  makeDevice,
  makeJob,
  testCredentials,
} from './fakes'

const REJECTED: CommandOutcome = {
  status: 'failed',
  error: 'Sign-in rejected with status 401',
  retryable: false,
  needsAttention: true,
  credentialsRejected: true,
}

/** Every write comes back as the vendor refusing our sign-in. */
class RejectedSignInProvider extends MockAccessControlProvider {
  override upsertSubject = async () => REJECTED
  override syncSubjectsToDevice = async () => REJECTED
  override setValidPeriod = async () => REJECTED
  override grantAccess = async () => REJECTED
  override blockAccess = async () => REJECTED
  override revokeBiometrics = async () => REJECTED
}

function build(provider: MockAccessControlProvider) {
  const repo = new FakeAccessControlRepository({
    credentials: testCredentials,
    devices: [makeDevice()],
    deviceSerials: ['SER-001'],
    contexts: [makeContext()],
    claimable: [makeJob({ id: 'job-1', gym_id: 'gym-1' })],
  })

  const drain = new DrainAccessSyncQueue(
    repo,
    new SyncMemberAccess(repo, provider),
    new OperateDevice(repo, provider),
    new EvictInactiveSubjects(repo, provider),
    provider
  )

  return { repo, drain }
}

describe('DrainAccessSyncQueue — rejected sign-in (F-03)', () => {
  it('dead-letters the job as needing attention and marks the account once', async () => {
    const { repo, drain } = build(new RejectedSignInProvider())

    const summary = await drain.execute({ today: day('2026-10-10') })

    expect(summary.deadLettered).toBe(1)
    expect(summary.needingAttention).toBe(1)
    expect(summary.retrying).toBe(0)
    expect(repo.settled).toEqual([
      expect.objectContaining({
        jobId: 'job-1',
        outcome: 'failed',
        retryable: false,
      }),
    ])
    expect(repo.verificationFailures).toEqual(['gym-1'])
  })

  it('leaves the account alone when the failure is an ordinary retryable one', async () => {
    class BusyProvider extends MockAccessControlProvider {
      override setValidPeriod = async (): Promise<CommandOutcome> => ({
        status: 'failed',
        error: 'Vendor returned status 503',
        retryable: true,
      })
    }
    const { repo, drain } = build(new BusyProvider())

    const summary = await drain.execute({ today: day('2026-10-10') })

    expect(summary.retrying).toBe(1)
    expect(repo.verificationFailures).toHaveLength(0)
  })
})
