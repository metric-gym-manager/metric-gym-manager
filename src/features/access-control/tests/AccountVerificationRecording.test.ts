/**
 * A failed check has to be written down.
 *
 * Staleness alone would have taken a day to show the twenty-five-day outage,
 * and only because nothing refreshed it. The stronger signal is the failure
 * itself: the moment a check fails, or a nightly job finds the credentials
 * unreadable, the card must stop claiming Connected.
 */

import { VerifyAccessAccount } from '@/features/access-control/services/VerifyAccessAccount'
import { DrainAccessSyncQueue } from '@/features/access-control/services/DrainAccessSyncQueue'
import { SyncMemberAccess } from '@/features/access-control/services/SyncMemberAccess'
import { OperateDevice } from '@/features/access-control/services/OperateDevice'
import { EvictInactiveSubjects } from '@/features/access-control/services/EvictInactiveSubjects'
import {
  CredentialDecryptionError,
  MockAccessControlProvider,
} from '@/lib/access-control'
import type { AccessCredentials } from '@/lib/access-control'
import {
  FakeAccessControlRepository,
  day,
  makeContext,
  makeDevice,
  makeJob,
  testCredentials,
} from './fakes'

/** A provider whose sign-in probe refuses, as a wrong password would. */
class RefusingProvider extends MockAccessControlProvider {
  override async verifyCredentials(
    _credentials: AccessCredentials
  ): Promise<boolean> {
    return false
  }
}

describe('recording that a credential check failed', () => {
  it('clears the confirmation when the vendor refuses the sign-in', async () => {
    const repo = new FakeAccessControlRepository({
      credentials: testCredentials,
    })

    const result = await new VerifyAccessAccount(
      repo,
      new RefusingProvider()
    ).execute('gym-1')

    expect(result.verified).toBe(false)
    expect(repo.verificationFailures).toContain('gym-1')
  })

  it('does not clear it when the sign-in succeeds', async () => {
    const repo = new FakeAccessControlRepository({
      credentials: testCredentials,
    })

    await new VerifyAccessAccount(
      repo,
      new MockAccessControlProvider()
    ).execute('gym-1')

    expect(repo.verificationFailures).toHaveLength(0)
  })

  it('clears the confirmation when a nightly job cannot read the credentials', async () => {
    const repo = new FakeAccessControlRepository({
      credentials: testCredentials,
      devices: [makeDevice()],
      contexts: [makeContext()],
      claimable: [makeJob()],
    })

    // Exactly what happened for twenty-five days: the jobs knew, and the only
    // screen a gym owner reads said Connected throughout.
    repo.getCredentials = async () => {
      throw new CredentialDecryptionError('authentication failed')
    }

    const provider = new MockAccessControlProvider()
    const drain = new DrainAccessSyncQueue(
      repo,
      new SyncMemberAccess(repo, provider),
      new OperateDevice(repo, provider),
      new EvictInactiveSubjects(repo, provider),
      provider
    )

    await drain.execute({ today: day('2026-01-10') })

    expect(repo.verificationFailures).toContain('gym-1')
  })
})
