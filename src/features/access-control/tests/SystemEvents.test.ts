/**
 * Reader system events that carry no member (visit 2, RB-1 input).
 *
 * Power failure (107), POE down (111) and reader online (237) describe the
 * reader, not a person, so they may arrive with no `EmpId`. Discarding them is
 * what would hide the one signal that could say a reader lost power; they are
 * stored with subject 0 and no member instead.
 */

import { RecordAccessEvents } from '@/features/access-control/services/RecordAccessEvents'
import { FakeAccessControlRepository, makeDevice } from './fakes'

function build() {
  const repo = new FakeAccessControlRepository({
    devices: [makeDevice({ timezone_offset_minutes: 330 })],
  })

  return { repo, useCase: new RecordAccessEvents(repo) }
}

describe('RecordAccessEvents — system events without a member', () => {
  it('stores a power-failure event that has no EmpId, as subject 0 with no member', async () => {
    const { repo, useCase } = build()

    const summary = await useCase.execute([
      { AttTime: '2026-10-10 13:25:00', DeviceID: 'SER-001', Event: '107' },
    ])

    expect(summary.malformed).toBe(0)
    expect(summary.stored).toBe(1)
    expect(repo.storedEvents).toHaveLength(1)
    expect(repo.storedEvents[0]).toMatchObject({
      subjectId: 0,
      memberId: null,
      eventCode: '107',
    })
  })

  it('stores an event with an empty EmpId as subject 0 too', async () => {
    const { repo, useCase } = build()

    const summary = await useCase.execute([
      {
        EmpId: '',
        AttTime: '2026-10-10 13:26:00',
        DeviceID: 'SER-001',
        Event: '237',
      },
    ])

    expect(summary.stored).toBe(1)
    expect(repo.storedEvents[0]).toMatchObject({
      subjectId: 0,
      memberId: null,
      eventCode: '237',
    })
  })

  it('still counts an event with no DeviceID as malformed', async () => {
    const { repo, useCase } = build()

    const summary = await useCase.execute([
      { AttTime: '2026-10-10 13:25:00', Event: '107' },
    ])

    expect(summary.malformed).toBe(1)
    expect(summary.stored).toBe(0)
    expect(repo.storedEvents).toHaveLength(0)
  })
})
