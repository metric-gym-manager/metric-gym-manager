/**
 * A refused scan of a member we would admit queues a forced re-push
 * (visit 1, D3).
 *
 * Four of five enrolments on visit 1 were refused with event 23 "invalid time
 * period" until a re-send carried an Access Grant — including enrolments made
 * at the reader's own menu, which no step of ours sees. So a refused
 * FINGERPRINT scan (23 no access rights, 29 membership expired) of a member our
 * own decision allows is the signal that the reader's record is wrong, and the
 * repair is a forced re-push. It is bounded to once per member per 15 minutes:
 * a reader with a wrong clock would otherwise refuse everyone forever and queue
 * a job per scan.
 */

import { RecordAccessEvents } from '@/features/access-control/services/RecordAccessEvents'
import { AccessIntent } from '@/features/access-control/config/AccessControlConfig'
import {
  FakeAccessControlRepository,
  day,
  makeContext,
  makeDevice,
  makeSubject,
} from './fakes'

function scan(overrides: Record<string, string> = {}) {
  return {
    EmpId: '100001',
    AttTime: '2026-10-10 12:00:00',
    DeviceID: 'SER-001',
    VerifyType: '1',
    CheckingStatus: '0',
    Event: '23',
    ...overrides,
  }
}

/** An active member paid far into the future, so the verdict is stable. */
function build(contextOverrides: Parameters<typeof makeContext>[0] = {}) {
  const repo = new FakeAccessControlRepository({
    devices: [makeDevice({ timezone_offset_minutes: 330 })],
    contexts: [
      makeContext({
        memberId: 'member-1',
        nextDueDate: day('2099-01-01'),
        subject: makeSubject({ subject_id: 100001, finger_enrolled: true }),
        ...contextOverrides,
      }),
    ],
  })

  return { repo, useCase: new RecordAccessEvents(repo) }
}

const repairs = (repo: FakeAccessControlRepository) =>
  repo.enqueued.filter((job) => job.payload?.reason === 'door_refused')

describe('RecordAccessEvents — refusal repair (visit 1, D3)', () => {
  it('queues one forced re-push for a refused fingerprint scan of an entitled member', async () => {
    const { repo, useCase } = build()

    const summary = await useCase.execute([scan()])

    expect(repairs(repo)).toEqual([
      {
        gymId: 'gym-1',
        memberId: 'member-1',
        intent: AccessIntent.ReconcileMember,
        payload: { reason: 'door_refused', force: true },
      },
    ])
    expect(summary.refusalRepairsQueued).toBe(1)
  })

  it('treats event 29 (membership expired) the same way', async () => {
    const { repo, useCase } = build()

    await useCase.execute([scan({ Event: '29' })])

    expect(repairs(repo)).toHaveLength(1)
  })

  it('queues nothing for a granted scan', async () => {
    const { repo, useCase } = build()

    const summary = await useCase.execute([scan({ Event: '3' })])

    expect(repairs(repo)).toHaveLength(0)
    expect(summary.refusalRepairsQueued).toBe(0)
  })

  it('queues nothing when our own decision also refuses the member', async () => {
    // The reader is right: the due date has passed. Re-pushing would only
    // re-assert the refusal.
    const { repo, useCase } = build({ nextDueDate: day('2020-01-01') })

    await useCase.execute([scan()])

    expect(repairs(repo)).toHaveLength(0)
  })

  it('queues one job, not two, for refusals a minute apart', async () => {
    const { repo, useCase } = build()

    await useCase.execute([scan({ AttTime: '2026-10-10 12:00:00' })])
    await useCase.execute([scan({ AttTime: '2026-10-10 12:01:00' })])

    expect(repairs(repo)).toHaveLength(1)
  })

  it('ignores a refused card scan', async () => {
    const { repo, useCase } = build()

    await useCase.execute([scan({ VerifyType: '2' })])

    expect(repairs(repo)).toHaveLength(0)
  })

  it('still stores the scan, records the error and does not throw when the lookup fails', async () => {
    const { repo, useCase } = build()
    jest
      .spyOn(repo, 'getMemberAccessContext')
      .mockRejectedValueOnce(new Error('database exploded'))

    const summary = await useCase.execute([scan()])

    expect(summary.stored).toBe(1)
    expect(summary.errors).toEqual([
      expect.stringContaining('Refusal repair for member member-1'),
    ])
    expect(repairs(repo)).toHaveLength(0)
  })
})
