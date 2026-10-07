/**
 * "Re-send to readers" re-sends.
 *
 * Found reading the live vendor queue on 2026-10-07: Device B had been offline
 * since at least 3 October with four commands never transmitted, while our
 * record listed B as holding both members they were for. The desk's only
 * remedy for a reader that disagrees with us is this button — and it diffed
 * the member against our own record, which agrees with itself however wrong
 * it is. So it sent nothing and said "Readers updated".
 *
 * The outbox and the nightly reconcile keep diffing: re-asserting every member
 * every night would be one vendor call per member per reader for no effect.
 * Only the manual override forces.
 */

import { SyncMemberAccess } from '@/features/access-control/services/SyncMemberAccess'
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

/** A member our record says every reader already holds, window and all. */
function setup(status: MemberStatus = MemberStatus.Active) {
  const repo = new FakeAccessControlRepository({
    credentials: testCredentials,
    deviceSerials: ['SER-A', 'SER-B'],
    contexts: [
      makeContext({
        memberId: MEMBER,
        status,
        membershipStartDate: day('2026-10-03'),
        nextDueDate: day('2027-04-03'),
        subject: makeSubject({
          synced_device_serials: ['SER-A', 'SER-B'],
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

const serialsFor = (provider: MockAccessControlProvider, operation: string) =>
  provider.getCommandsOfType(operation).map((c) => c.deviceSerial)

describe('SyncMemberAccess — forced re-send', () => {
  it('sends nothing unforced when our record already matches — the diff the outbox relies on', async () => {
    const { provider, sync } = setup()

    const result = await sync.execute({ memberId: MEMBER, today: TODAY })

    expect(result.commandsSent).toBe(0)
    expect(provider.getCommands()).toHaveLength(0)
  })

  it('pushes the member, lifts any block and re-sends the window to every reader when forced', async () => {
    const { provider, sync } = setup()

    const result = await sync.execute({
      memberId: MEMBER,
      today: TODAY,
      force: true,
    })

    expect(result.failures).toEqual([])
    expect(serialsFor(provider, 'syncSubjectsToDevice')).toEqual([
      'SER-A',
      'SER-B',
    ])
    expect(serialsFor(provider, 'grantAccess')).toEqual(['SER-A', 'SER-B'])
    expect(serialsFor(provider, 'setValidPeriod')).toEqual(['SER-A', 'SER-B'])
    expect(result.commandsSent).toBe(6)
  })

  it('records every active reader as holding the member afterwards', async () => {
    const { repo, sync } = setup()

    await sync.execute({ memberId: MEMBER, today: TODAY, force: true })

    expect(repo.syncStates.get(MEMBER)).toMatchObject({
      syncedDeviceSerials: ['SER-A', 'SER-B'],
      validFrom: '20261003',
      validTo: '20270403',
      blocked: false,
    })
  })

  it('re-sends only the block, never a window, for a member who cannot get in', async () => {
    const { provider, sync } = setup(MemberStatus.Suspended)

    await sync.execute({ memberId: MEMBER, today: TODAY, force: true })

    expect(serialsFor(provider, 'blockAccess')).toEqual(['SER-A', 'SER-B'])
    expect(provider.getCommandsOfType('setValidPeriod')).toHaveLength(0)
    expect(provider.getCommandsOfType('syncSubjectsToDevice')).toHaveLength(0)
  })
})
