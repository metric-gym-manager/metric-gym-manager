/**
 * The webhook resolves members once per delivery (remote day, F-09).
 *
 * A reader that was offline uploads its whole buffer in one delivery, and the
 * webhook used to look up each scan's member with its own query: a few hundred
 * scans were a few hundred sequential round trips inside one request, with
 * nothing to cap them. The member mapping is per SUBJECT, so a delivery of 500
 * scans for 3 people needs 3 lookups, and one query for all of them.
 */

import { RecordAccessEvents } from '@/features/access-control/services/RecordAccessEvents'
import {
  FakeAccessControlRepository,
  makeContext,
  makeDevice,
  makeSubject,
} from './fakes'

const SERIAL = 'SER-001'

/** Distinct, reader-local wall-clock times one second apart. */
function at(n: number): string {
  const base = Date.UTC(2026, 9, 9, 8, 0, 0) + n * 1000
  return new Date(base).toISOString().slice(0, 19).replace('T', ' ')
}

function scan(n: number, empId: string) {
  return {
    EmpId: empId,
    AttTime: at(n),
    DeviceID: SERIAL,
    VerifyType: '1',
    CheckingStatus: '0',
    Event: '3',
  }
}

function build() {
  const repo = new FakeAccessControlRepository({
    devices: [makeDevice({ device_serial: SERIAL, gym_id: 'gym-1' })],
    contexts: [
      makeContext({
        memberId: 'member-a',
        subject: makeSubject({ member_id: 'member-a', subject_id: 100001 }),
      }),
      makeContext({
        memberId: 'member-b',
        subject: makeSubject({ member_id: 'member-b', subject_id: 100002 }),
      }),
    ],
  })

  return { repo, useCase: new RecordAccessEvents(repo) }
}

describe('RecordAccessEvents — members resolved once per delivery (F-09)', () => {
  it('looks up 3 subjects in one query for a 500-scan delivery', async () => {
    const { repo, useCase } = build()
    const batch = jest.spyOn(repo, 'findMemberIdsBySubjectIds')
    const single = jest.spyOn(repo, 'findMemberIdBySubjectId')

    // 500 scans across subjects 100001, 100002 and an unknown 999999.
    const ids = ['100001', '100002', '999999']
    const payload = Array.from({ length: 500 }, (_, n) =>
      scan(n, ids[n % ids.length])
    )

    const summary = await useCase.execute(payload)

    expect(summary.stored).toBe(500)
    expect(batch).toHaveBeenCalledTimes(1)
    expect(batch).toHaveBeenCalledWith('gym-1', [100001, 100002, 999999])
    expect(single).not.toHaveBeenCalled()
  })

  it('stores each scan against its own member, and null for an unknown subject', async () => {
    const { repo, useCase } = build()

    await useCase.execute([
      scan(0, '100001'),
      scan(1, '100002'),
      scan(2, '999999'),
      scan(3, '100001'),
    ])

    const memberOf = (n: number) => repo.storedEvents[n].memberId
    expect([memberOf(0), memberOf(1), memberOf(2), memberOf(3)]).toEqual([
      'member-a',
      'member-b',
      null,
      'member-a',
    ])
  })

  it('stores a scan with a non-numeric id against no member and asks about no one for it', async () => {
    const { repo, useCase } = build()
    const batch = jest.spyOn(repo, 'findMemberIdsBySubjectIds')

    const summary = await useCase.execute([scan(0, 'not-a-number')])

    expect(summary.stored).toBe(1)
    expect(repo.storedEvents[0].memberId).toBeNull()
    // Nothing finite to look up: either no call or an empty one, never a guess.
    const asked = batch.mock.calls.flatMap((call) => call[1])
    expect(asked).toEqual([])
  })
})
