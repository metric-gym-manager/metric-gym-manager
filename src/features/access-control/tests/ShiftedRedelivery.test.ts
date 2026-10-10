/**
 * Scans the vendor re-sends in UTC are duplicates (remote day, F-01).
 *
 * `GetEventsbyDevSN` makes the vendor re-deliver stored scans through the
 * webhook, but with `AttTime` in UTC where a live delivery uses the reader's
 * local time, and with no field that marks it as pulled. The copy therefore
 * lands `timezone_offset_minutes` EARLIER than its original, passes the unique
 * key, and was stored as a second scan — and, being old, its timestamp was then
 * used to "measure" the reader's clock, reporting hours of drift that did not
 * exist. A pulled copy can only be recognised as an existing row shifted by
 * exactly the reader's offset, and clock skew may only come from a delivery that
 * stored something new.
 */

import { RecordAccessEvents } from '@/features/access-control/services/RecordAccessEvents'
import { FakeAccessControlRepository, makeDevice } from './fakes'
import type { IncomingAccessEvent } from '@/features/access-control/services/IAccessControlRepository'

const OFFSET_MINUTES = 330
const GYM = 'gym-1'
const SERIAL = 'SER-001'

/** The wire form of one scan, as a reader or a pulled delivery sends it. */
function scan(overrides: Record<string, string> = {}) {
  return {
    EmpId: '1',
    AttTime: '2026-10-09 07:04:07',
    DeviceID: SERIAL,
    VerifyType: '1',
    CheckingStatus: '0',
    Event: '3',
    ...overrides,
  }
}

/** An original already in the log, as a live delivery stored it. */
function stored(
  overrides: Partial<IncomingAccessEvent> = {}
): IncomingAccessEvent {
  return {
    deviceSerial: SERIAL,
    subjectId: 1,
    memberId: null,
    occurredAt: new Date('2026-10-09T07:04:07Z'),
    verifyType: 1,
    checkingStatus: 0,
    eventCode: '3',
    raw: {},
    ...overrides,
  }
}

async function build(offsetMinutes = OFFSET_MINUTES, original = stored()) {
  const repo = new FakeAccessControlRepository({
    devices: [
      makeDevice({
        gym_id: GYM,
        device_serial: SERIAL,
        timezone_offset_minutes: offsetMinutes,
      }),
    ],
  })
  await repo.recordEvents(GYM, [original])
  return { repo, useCase: new RecordAccessEvents(repo) }
}

describe('RecordAccessEvents — shifted re-delivery (F-01)', () => {
  it('drops a pulled copy of a scan we already hold and records no skew from it', async () => {
    const { repo, useCase } = await build()
    const skew = jest.spyOn(repo, 'recordDeviceClockSkew')

    // The same scan, its wall-clock fields now in UTC: 07:04:07 where the
    // original, read as reader-local 12:34:07, is 07:04:07Z.
    const summary = await useCase.execute([scan()])

    expect(summary.stored).toBe(0)
    expect(summary.duplicates).toBe(1)
    expect(summary.redeliveredShifted).toBe(1)
    expect(repo.storedEvents).toHaveLength(1)
    // The copy is hours old by construction; measuring the clock from it is the
    // bug that reported drift on a healthy reader.
    expect(skew).not.toHaveBeenCalled()
  })

  it('stores a fresh scan beside a pulled copy and measures the clock from the fresh one', async () => {
    const { repo, useCase } = await build()
    const receivedAt = new Date()
    // Reader-local wall clock "now".
    const freshLocal = new Date(receivedAt.getTime() + OFFSET_MINUTES * 60_000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ')

    const summary = await useCase.execute(
      [scan(), scan({ EmpId: '2', AttTime: freshLocal })],
      receivedAt
    )

    expect(summary.stored).toBe(1)
    expect(summary.redeliveredShifted).toBe(1)
    expect(repo.clockSkews).toHaveLength(1)
    expect(Math.abs(repo.clockSkews[0].skewSeconds)).toBeLessThan(60)
  })

  it('records no skew for an exact re-delivery of a live scan', async () => {
    const { repo, useCase } = await build()
    const skew = jest.spyOn(repo, 'recordDeviceClockSkew')

    // Same wall-clock fields as the stored scan once read as reader-local.
    const summary = await useCase.execute([
      scan({ AttTime: '2026-10-09 12:34:07' }),
    ])

    expect(summary.stored).toBe(0)
    expect(summary.duplicates).toBe(1)
    expect(summary.redeliveredShifted).toBe(0)
    expect(skew).not.toHaveBeenCalled()
  })

  it('does not treat a different event code at the shifted instant as a duplicate', async () => {
    const { repo, useCase } = await build()

    // Same subject, exactly the offset apart, but a REFUSAL where the original
    // was a grant: a different event, not a copy.
    const summary = await useCase.execute([scan({ Event: '23' })])

    expect(summary.stored).toBe(1)
    expect(summary.redeliveredShifted).toBe(0)
    expect(repo.storedEvents).toHaveLength(2)
  })

  it('does not look for shifted copies on a reader at UTC', async () => {
    const { repo, useCase } = await build(0)
    const lookup = jest.spyOn(repo, 'findExistingEvents')

    await useCase.execute([scan()])

    expect(lookup).not.toHaveBeenCalled()
  })

  it('keeps counting a shifted copy only once in the duplicates total', async () => {
    const { useCase } = await build()

    const summary = await useCase.execute([scan()])

    expect(summary.duplicates).toBe(1)
    expect(summary.received).toBe(1)
  })
})
