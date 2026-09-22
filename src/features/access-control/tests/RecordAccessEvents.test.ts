/**
 * Webhook ingestion.
 *
 * The callback carries no authentication and is account-wide, so the two things
 * this must never do are both about trust:
 *
 *  - **Never guess at an unknown reader.** On a shared vendor account we can
 *    legitimately receive another company's traffic.
 *  - **Never take identity from the payload.** The gym comes from our own
 *    serial lookup, the member from our own subject mapping.
 */

import { RecordAccessEvents } from '@/features/access-control/services/RecordAccessEvents'
import { DEVICE_CLOCK_SKEW_ALERT_SECONDS } from '@/features/access-control/config/AccessControlConfig'
import {
  FakeAccessControlRepository,
  makeContext,
  makeDevice,
  makeSubject,
} from './fakes'

/** Colombo is UTC+5:30, so a device stamp of 12:00 is 06:30 UTC. */
const COLOMBO_OFFSET = 330

function event(overrides: Record<string, string> = {}) {
  return {
    EmpId: '100001',
    AttTime: '2026-01-10 12:00:00',
    DeviceID: 'SER-001',
    VerifyType: '1',
    CheckingStatus: '0',
    Event: '0',
    ...overrides,
  }
}

function build(
  devices = [makeDevice({ timezone_offset_minutes: COLOMBO_OFFSET })]
) {
  const repo = new FakeAccessControlRepository({
    devices,
    contexts: [
      makeContext({
        memberId: 'member-1',
        subject: makeSubject({ subject_id: 100001 }),
      }),
    ],
  })

  return { repo, useCase: new RecordAccessEvents(repo) }
}

describe('RecordAccessEvents', () => {
  /**
   * Scans are pushed once and never re-sent: the reader gets its 200 and moves
   * on. So a batch we fail to parse is not a retry, it is a **permanent hole in
   * the check-in history**, produced silently.
   *
   * The device-list probe of 2026-09-22 proved what the vendor's own JSON looks
   * like in practice — numbers where the documented example shows strings, and
   * `null` for anything absent (13 of 27 fields on a working reader). The
   * webhook contract we hold is one hand-written example from the Postman
   * collection, which is weaker evidence than that. Parsing it strictly means
   * one unexpected scalar discards every scan delivered alongside it.
   */
  describe('vendor payload tolerance', () => {
    it('accepts numeric scalars where the collection shows strings', async () => {
      const { repo, useCase } = build()

      const summary = await useCase.execute([
        {
          EmpId: 100001,
          AttTime: '2026-01-10 12:00:00',
          DeviceID: 'SER-001',
          VerifyType: 1,
          CheckingStatus: 0,
          Event: 3,
        },
      ])

      expect(summary.stored).toBe(1)
      expect(repo.storedEvents[0]).toMatchObject({
        subjectId: 100001,
        verifyType: 1,
        checkingStatus: 0,
        eventCode: '3',
      })
    })

    it('accepts null for the optional code fields', async () => {
      const { repo, useCase } = build()

      const summary = await useCase.execute([
        {
          EmpId: '100001',
          AttTime: '2026-01-10 12:00:00',
          DeviceID: 'SER-001',
          VerifyType: null,
          CheckingStatus: null,
          Event: null,
        },
      ])

      expect(summary.stored).toBe(1)
      expect(repo.storedEvents[0]).toMatchObject({
        verifyType: null,
        checkingStatus: null,
        eventCode: null,
      })
    })

    it('keeps the good scans when one event in the batch is unusable', async () => {
      const { repo, useCase } = build()

      const summary = await useCase.execute([
        event(),
        { EmpId: '100001', DeviceID: 'SER-001' }, // no AttTime: unusable
        event({ AttTime: '2026-01-10 12:05:00' }),
      ])

      // The whole point: one bad row must not discard its neighbours.
      expect(summary.stored).toBe(2)
      expect(summary.malformed).toBe(1)
      expect(summary.received).toBe(3)
      expect(repo.storedEvents).toHaveLength(2)
    })

    it('trims whitespace around the serial before resolving the reader', async () => {
      const { useCase } = build()

      const summary = await useCase.execute([event({ DeviceID: ' SER-001 ' })])

      // An unknown serial is dropped, so a stray space would lose the scan and
      // report it as another company's traffic.
      expect(summary.stored).toBe(1)
      expect(summary.unknownDevice).toBe(0)
    })

    it('stores the serial we registered, not the spelling the reader sent', async () => {
      const { repo, useCase } = build()

      await useCase.execute([event({ DeviceID: ' Ser-001 ' })])

      // Resolving leniently is right; propagating the loose spelling is not.
      // `access_events.device_serial` is filtered and grouped on, so a second
      // spelling splits one reader's history into two buckets.
      expect(repo.storedEvents[0].deviceSerial).toBe('SER-001')
    })

    it('records clock skew against the registered serial', async () => {
      const { repo, useCase } = build()

      await useCase.execute([event({ DeviceID: 'ser-001' })])

      // `recordDeviceClockSkew` filters on the serial, and a Supabase update
      // that matches nothing reports success — so a loose spelling here means
      // last_seen_at and drift silently stop being recorded for that reader.
      expect(repo.clockSkews[0].deviceSerial).toBe('SER-001')
    })

    it('accepts a single event that is not wrapped in an array', async () => {
      const { useCase } = build()

      // The collection's example is an array, and that is what we expect. But a
      // firmware build that posts one scan bare would otherwise have every
      // delivery discarded, and we would never hear about it.
      const summary = await useCase.execute(event())

      expect(summary.stored).toBe(1)
    })

    it('counts a body that is not events at all as malformed', async () => {
      const { useCase } = build()

      const summary = await useCase.execute({ not: 'an event' })

      expect(summary.stored).toBe(0)
      expect(summary.malformed).toBe(1)
      expect(summary.errors.length).toBeGreaterThan(0)
    })
  })

  describe('payload handling', () => {
    it('rejects a body that is not events at all, without throwing', async () => {
      const { useCase } = build()

      // A bare string cannot be an event or a batch of them. An *object* is a
      // different case — it is treated as one unwrapped event and reported per
      // event, which the tolerance suite below covers.
      const summary = await useCase.execute('nonsense')

      expect(summary.stored).toBe(0)
      expect(summary.errors).toEqual(['Malformed webhook payload'])
    })

    it('handles an empty batch', async () => {
      const { useCase } = build()

      const summary = await useCase.execute([])

      expect(summary).toMatchObject({ received: 0, stored: 0 })
    })

    it('stores a scan and resolves the member from our own mapping', async () => {
      const { repo, useCase } = build()

      const summary = await useCase.execute([event()])

      expect(summary.stored).toBe(1)
      expect(repo.storedEvents[0]).toMatchObject({
        deviceSerial: 'SER-001',
        subjectId: 100001,
        verifyType: 1,
        checkingStatus: 0,
      })
      // A column, not a field inside `raw`: the check-in log filters on it.
      expect(repo.storedEvents[0]?.memberId).toBe('member-1')
    })

    it('keeps the raw event whole, including codes we do not map', async () => {
      const { repo, useCase } = build()

      await useCase.execute([event({ Event: '9999' })])

      // The vendor code tables are not exhaustive, so an unmapped value must
      // still be recoverable after the fact.
      expect(repo.storedEvents[0]?.raw).toMatchObject({ Event: '9999' })
      expect(repo.storedEvents[0]?.eventCode).toBe('9999')
    })
  })

  describe('unknown readers', () => {
    it('counts and drops traffic from a serial we do not know', async () => {
      const { repo, useCase } = build()

      const summary = await useCase.execute([
        event({ DeviceID: 'SOMEONE-ELSE' }),
      ])

      expect(summary.unknownDevice).toBe(1)
      expect(summary.stored).toBe(0)
      expect(repo.storedEvents).toHaveLength(0)
    })

    it('still stores the known readers in a mixed batch', async () => {
      const { useCase } = build()

      const summary = await useCase.execute([
        event(),
        event({ DeviceID: 'SOMEONE-ELSE', AttTime: '2026-01-10 12:00:01' }),
      ])

      expect(summary.stored).toBe(1)
      expect(summary.unknownDevice).toBe(1)
    })
  })

  describe('device-local time', () => {
    it('converts using that device offset, not a global constant', async () => {
      const { repo, useCase } = build()

      await useCase.execute([event({ AttTime: '2026-01-10 12:00:00' })])

      expect(repo.storedEvents[0]?.occurredAt.toISOString()).toBe(
        '2026-01-10T06:30:00.000Z'
      )
    })

    it('converts two readers in different timezones independently', async () => {
      const { repo, useCase } = build([
        makeDevice({ timezone_offset_minutes: COLOMBO_OFFSET }),
        makeDevice({
          id: 'device-2',
          device_serial: 'SER-002',
          timezone_offset_minutes: 0,
        }),
      ])

      await useCase.execute([
        event({ DeviceID: 'SER-001', AttTime: '2026-01-10 12:00:00' }),
        event({ DeviceID: 'SER-002', AttTime: '2026-01-10 12:00:00' }),
      ])

      const times = repo.storedEvents
        .map((e) => e.occurredAt.toISOString())
        .sort()

      expect(times).toEqual([
        '2026-01-10T06:30:00.000Z',
        '2026-01-10T12:00:00.000Z',
      ])
    })

    it('records an unparseable timestamp as an error rather than storing a bad instant', async () => {
      const { repo, useCase } = build()

      const summary = await useCase.execute([event({ AttTime: 'yesterday' })])

      expect(summary.stored).toBe(0)
      expect(summary.errors[0]).toContain('yesterday')
      expect(repo.storedEvents).toHaveLength(0)
    })
  })

  describe('clock skew', () => {
    it('infers no drift from a reader whose clock agrees', async () => {
      const { repo, useCase } = build()

      await useCase.execute(
        [event({ AttTime: '2026-01-10 12:00:00' })],
        new Date('2026-01-10T06:30:00Z')
      )

      expect(repo.clockSkews).toEqual([
        { deviceSerial: 'SER-001', skewSeconds: 0 },
      ])
    })

    it('flags a reader whose clock has drifted far enough to matter', async () => {
      const { useCase } = build()

      const driftSeconds = DEVICE_CLOCK_SKEW_ALERT_SECONDS + 60

      const summary = await useCase.execute(
        [event({ AttTime: '2026-01-10 12:00:00' })],
        new Date(Date.parse('2026-01-10T06:30:00Z') - driftSeconds * 1000)
      )

      // The expiry cutover is enforced against this clock, and the API exposes
      // no way to read it — inference is the only visibility we get.
      expect(summary.driftingDevices).toEqual(['SER-001'])
    })
  })

  describe('idempotence', () => {
    it('counts a redelivered scan as a duplicate, not a second entry', async () => {
      const { repo, useCase } = build()

      await useCase.execute([event()])
      const summary = await useCase.execute([event()])

      expect(summary.stored).toBe(0)
      expect(summary.duplicates).toBe(1)
      expect(repo.storedEvents).toHaveLength(1)
    })
  })
})
