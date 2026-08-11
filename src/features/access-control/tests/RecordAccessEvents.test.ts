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
  describe('payload handling', () => {
    it('rejects a malformed body without throwing', async () => {
      const { useCase } = build()

      const summary = await useCase.execute({ not: 'an array' })

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
      expect(repo.storedEvents[0]?.raw).toMatchObject({
        resolvedMemberId: 'member-1',
      })
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
