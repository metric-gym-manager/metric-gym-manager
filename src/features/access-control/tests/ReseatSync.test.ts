/**
 * SyncMemberAccess with a re-seat (visit 1, D1).
 *
 * A re-seat revokes the member from every reader and then pushes them back, so
 * the record of who holds the member has to follow the commands IN ORDER: the
 * old "pushes first, then drop whatever was revoked" rule would end a
 * successful re-seat claiming reader A no longer holds a member who was just
 * put back on it. And because `fromdev` has already removed the member from
 * every reader by the time a later command fails, a half-finished re-seat must
 * not leave our record saying the readers still hold them.
 */

import { SyncMemberAccess } from '@/features/access-control/services/SyncMemberAccess'
import { AccessIntent } from '@/features/access-control/config/AccessControlConfig'
import { MockAccessControlProvider } from '@/lib/access-control'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import {
  FakeAccessControlRepository,
  makeContext,
  makeSubject,
  testCredentials,
  day,
} from './fakes'

const MEMBER = 'member-1'
const TODAY = day('2026-10-07')

function setup(status: MemberStatus = MemberStatus.Active) {
  const repo = new FakeAccessControlRepository({
    credentials: testCredentials,
    deviceSerials: ['A', 'B'],
    contexts: [
      makeContext({
        memberId: MEMBER,
        status,
        membershipStartDate: day('2026-10-03'),
        nextDueDate: day('2027-04-03'),
        subject: makeSubject({
          synced_device_serials: ['A', 'B'],
          last_synced_valid_from: '20261003',
          last_synced_valid_to: '20270403',
          last_synced_blocked: status !== MemberStatus.Active,
        }),
      }),
    ],
  })

  const provider = new MockAccessControlProvider()
  return { repo, provider, sync: new SyncMemberAccess(repo, provider) }
}

describe('SyncMemberAccess — re-seat (visit 1, D1)', () => {
  it('records both readers as holding the member after a successful re-seat', async () => {
    const { repo, sync } = setup()

    const result = await sync.execute({
      memberId: MEMBER,
      today: TODAY,
      reseat: true,
    })

    expect(result.failures).toHaveLength(0)
    expect(
      [...(repo.syncStates.get(MEMBER)?.syncedDeviceSerials ?? [])].sort()
    ).toEqual(['A', 'B'])
  })

  it('still records no readers after a cancellation (unchanged)', async () => {
    const { repo, sync } = setup(MemberStatus.Cancelled)

    await sync.execute({ memberId: MEMBER, today: TODAY })

    expect(repo.syncStates.get(MEMBER)?.syncedDeviceSerials).toEqual([])
  })

  it('marks the subject off every reader when a re-seat stops after the revoke', async () => {
    const { repo, provider, sync } = setup()
    jest.spyOn(provider, 'syncSubjectsToDevice').mockResolvedValueOnce({
      status: 'failed',
      error: 'Vendor returned status 502',
      retryable: true,
    })

    const result = await sync.execute({
      memberId: MEMBER,
      today: TODAY,
      reseat: true,
    })

    expect(result.failures).toHaveLength(1)
    // fromdev already took the member off every reader, so our record must say
    // so even though the run did not finish.
    expect(repo.offDevice).toEqual([MEMBER])
    expect(repo.syncStates.has(MEMBER)).toBe(false)
  })

  it('leaves the record alone when the revoke itself is what failed', async () => {
    const { repo, provider, sync } = setup()
    jest.spyOn(provider, 'revokeBiometrics').mockResolvedValueOnce({
      status: 'failed',
      error: 'Vendor returned status 502',
      retryable: true,
    })

    await sync.execute({ memberId: MEMBER, today: TODAY, reseat: true })

    // Nothing was sent, so nothing was removed.
    expect(repo.offDevice).toEqual([])
  })

  describe('retryOnFailure', () => {
    const failFirstPush = (provider: MockAccessControlProvider) =>
      jest.spyOn(provider, 'syncSubjectsToDevice').mockResolvedValueOnce({
        status: 'failed',
        error: 'Vendor returned status 502',
        retryable: true,
      })

    it('queues one forced reconcile when a forced sync fails', async () => {
      const { repo, provider, sync } = setup()
      failFirstPush(provider)

      await sync.execute({
        memberId: MEMBER,
        today: TODAY,
        force: true,
        retryOnFailure: true,
      })

      expect(repo.enqueued).toEqual([
        {
          gymId: 'gym-1',
          memberId: MEMBER,
          intent: AccessIntent.ReconcileMember,
          payload: { reason: 'desk_resend_failed', force: true },
        },
      ])
    })

    it('queues nothing when retryOnFailure is not set', async () => {
      const { repo, provider, sync } = setup()
      failFirstPush(provider)

      await sync.execute({ memberId: MEMBER, today: TODAY, force: true })

      expect(repo.enqueued).toHaveLength(0)
    })

    it('queues nothing when the sync succeeds', async () => {
      const { repo, sync } = setup()

      await sync.execute({
        memberId: MEMBER,
        today: TODAY,
        force: true,
        retryOnFailure: true,
      })

      expect(repo.enqueued).toHaveLength(0)
    })
  })
})
