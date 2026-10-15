/**
 * Pulled events keep their real time and never set the clock skew (visit 2, CD-2).
 *
 * A live delivery stamps `AttTime` in the reader's local time; an events pull
 * (`GetEventsbyDevSN`) re-delivers stored scans with `AttTime` in UTC. While a
 * pull marker for the reader is open (DEC2-08), an event whose stamp READ AS
 * UTC is no later than receipt + 120 s is a pulled one: a live scan read as UTC
 * lands about 5 h 30 min in the future, so it can never pass that test.
 */

import { RecordAccessEvents } from '@/features/access-control/services/RecordAccessEvents'
import { AccessIntent } from '@/features/access-control/config/AccessControlConfig'
import { FakeAccessControlRepository, makeDevice } from './fakes'

/** Colombo, UTC+5:30. */
const OFFSET = 330
const RECEIVED = new Date('2026-10-09T08:00:00Z')

function event(overrides: Record<string, string> = {}) {
  return {
    EmpId: '100001',
    AttTime: '2026-10-09 06:00:00',
    DeviceID: 'SER-001',
    VerifyType: '1',
    CheckingStatus: '0',
    Event: '0',
    ...overrides,
  }
}

async function build({ marker }: { marker: boolean }) {
  const repo = new FakeAccessControlRepository({
    devices: [makeDevice({ timezone_offset_minutes: OFFSET })],
  })

  if (marker) {
    await repo.enqueue('gym-1', null, AccessIntent.EventsPull, {
      deviceSerial: 'SER-001',
      dispatchedInline: true,
    })
  }

  return { repo, useCase: new RecordAccessEvents(repo) }
}

describe('RecordAccessEvents — events pull window', () => {
  it('treats a pulled copy of a stored scan as a plain duplicate and records no skew', async () => {
    const { repo, useCase } = await build({ marker: true })

    // The original: a live scan at 12:34:07 reader-local = 07:04:07Z.
    await useCase.execute(
      [event({ AttTime: '2026-10-09 12:34:07' })],
      new Date('2026-10-09T07:04:30Z')
    )
    expect(repo.storedEvents).toHaveLength(1)
    const skewsBefore = repo.clockSkews.length

    // The same scan, pulled: stamped in UTC.
    const summary = await useCase.execute(
      [event({ AttTime: '2026-10-09 07:04:07' })],
      RECEIVED
    )

    expect(repo.storedEvents).toHaveLength(1)
    expect(summary.stored).toBe(0)
    expect(summary.duplicates).toBe(1)
    expect(repo.clockSkews).toHaveLength(skewsBefore)
  })

  it('stores a scan recovered by the pull at its UTC instant and records no skew', async () => {
    const { repo, useCase } = await build({ marker: true })

    // UTC 2 hours before receipt.
    const summary = await useCase.execute(
      [event({ AttTime: '2026-10-09 06:00:00' })],
      RECEIVED
    )

    expect(summary.stored).toBe(1)
    expect(summary.pulledScans).toBe(1)
    expect(repo.storedEvents[0].occurredAt.toISOString()).toBe(
      '2026-10-09T06:00:00.000Z'
    )
    expect(repo.clockSkews).toHaveLength(0)
  })

  it('still treats a live scan as reader-local while a pull is open, and records its skew', async () => {
    const { repo, useCase } = await build({ marker: true })

    // Local now: 08:00Z is 13:30 in Colombo.
    const summary = await useCase.execute(
      [event({ AttTime: '2026-10-09 13:30:00' })],
      RECEIVED
    )

    expect(summary.pulledScans).toBe(0)
    expect(repo.storedEvents[0].occurredAt.toISOString()).toBe(
      '2026-10-09T08:00:00.000Z'
    )
    expect(repo.clockSkews).toEqual([
      { deviceSerial: 'SER-001', skewSeconds: 0 },
    ])
  })

  it('reads every stamp as reader-local when no pull was recorded', async () => {
    const { repo, useCase } = await build({ marker: false })

    const summary = await useCase.execute(
      [event({ AttTime: '2026-10-09 06:00:00' })],
      RECEIVED
    )

    expect(summary.pulledScans).toBe(0)
    // 06:00 reader-local is 00:30Z: the behaviour before this change.
    expect(repo.storedEvents[0].occurredAt.toISOString()).toBe(
      '2026-10-09T00:30:00.000Z'
    )
  })

  it('takes the clock skew from the live scan alone when a delivery carries both', async () => {
    const { repo, useCase } = await build({ marker: true })

    // A pulled scan 1 minute old, and a live scan 5 minutes old (13:25 local).
    // Were the pulled one allowed to speak, the skew would read -60, not -300.
    const summary = await useCase.execute(
      [
        event({ AttTime: '2026-10-09 07:59:00', Event: '1' }),
        event({ AttTime: '2026-10-09 13:25:00', Event: '2' }),
      ],
      RECEIVED
    )

    expect(summary.stored).toBe(2)
    expect(summary.pulledScans).toBe(1)
    expect(repo.clockSkews).toEqual([
      { deviceSerial: 'SER-001', skewSeconds: -300 },
    ])
  })
})
