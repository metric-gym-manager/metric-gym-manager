/**
 * Coverage of the vendor's own reference tables.
 *
 * These suites answer one question: **is every code the vendor documents
 * actually handled, or does it silently fall through a default?**
 *
 * That matters differently for each table. An unclassified *return* code gets
 * retried by the outbox, so a permanent failure would burn its whole retry
 * budget before anyone heard about it. An unclassified *event* code renders as
 * "Other" in a gym's activity log, which is the difference between "your
 * membership expired on the 15th" and a shrug.
 *
 * The full tables are transcribed from VFT's `CommandsReturnValues.pdf` and
 * `EventCodes.pdf`.
 */

import {
  classifyReturnCode,
  describeReturnCode,
  ReturnCodeClass,
} from '../returnCodes'
import {
  classifyDeviceEvent,
  codesForKind,
  describeDeviceEvent,
  DeviceEventKind,
} from '@/features/access-control/config/DeviceEventCodes'

/** Every return code in the vendor's table. */
const DOCUMENTED_RETURN_CODES: number[] = [
  ...Array.from({ length: 28 }, (_, i) => -(i + 1)).filter((c) => c !== -29),
  -30,
  -100,
  -101,
  -102,
  -103,
  -104,
  -105,
  -106,
  -107,
  -108,
  -201,
  -202,
  -203,
  -206,
  -301,
  -601,
  -603,
  -604,
  -609,
  -612,
  -614,
  -615,
  -616,
  -618,
  -619,
  -620,
  -621,
  -628,
  -629,
  -630,
  -631,
  -632,
  -701,
  -702,
  -703,
  -704,
  -705,
  -706,
  -707,
  -708,
  -709,
  -720,
  -721,
  -722,
  -723,
  -724,
  -725,
  -726,
  -727,
  -728,
  -729,
  -730,
  -731,
  -732,
  -801,
]

/**
 * Codes the vendor marks "Reserved. For firmware internal use only".
 *
 * Deliberately unclassified: we have no documented meaning to classify them
 * by, and the bounded-retry default is the safer guess for an unknown failure
 * than dead-lettering something that might have been transient.
 */
const RESERVED = new Set([
  -601, -701, -702, -703, -704, -705, -706, -707, -723, -724, -727, -729, -732,
])

/**
 * Every event code in the vendor's table — all 165 of them.
 *
 * ## This list was wrong, and wrong in the direction that hides bugs
 *
 * The previous transcription stopped at 74, carried only 100–110, omitted the
 * 132/150 blocks entirely, and explicitly filtered 219 and 224 out of the 200
 * block *as though the vendor did not define them*. So the suite asserted
 * "classifies every documented event code" against a table trimmed to fit the
 * implementation, and passed with **38 codes unclassified** — including 219,
 * a genuine entry, and 75, a genuine refusal.
 *
 * A coverage test whose expectation is edited to match the code under test is
 * worse than no coverage test: it reports the gap as closed. Transcribed again
 * from VFT_GYM_API_V2.0's "Event Codes" table, received 2026-08-28, verbatim
 * copy in `docs/integrations/vft/`.
 *
 * Gaps in the vendor's own numbering, all deliberate: **46**, **238**, **253**.
 */
const DOCUMENTED_EVENT_CODES: number[] = [
  // 0–45, then 47–80. No 46.
  ...Array.from({ length: 46 }, (_, i) => i),
  ...Array.from({ length: 34 }, (_, i) => i + 47),
  // 100–121: alarms, power, and line-detection wiring faults.
  ...Array.from({ length: 22 }, (_, i) => i + 100),
  // Elevator control, which a gym door install never has.
  132,
  133,
  134,
  ...Array.from({ length: 6 }, (_, i) => i + 150),
  // 200–237 then 239–252: door, reader and connectivity state. No 238, no 253.
  ...Array.from({ length: 38 }, (_, i) => i + 200),
  ...Array.from({ length: 14 }, (_, i) => i + 239),
  // 254 is the vendor's extended-event escape hatch; 255 is door status.
  254,
  255,
]

describe('return-code table coverage', () => {
  it('classifies every documented code that carries a meaning', () => {
    const unclassified = DOCUMENTED_RETURN_CODES.filter(
      (code) =>
        !RESERVED.has(code) &&
        classifyReturnCode(code) === ReturnCodeClass.Retryable &&
        // Retryable is also a real classification, so distinguish "we chose
        // retryable" from "we fell through" by checking for a description.
        describeReturnCode(code).startsWith('Device error')
    )

    expect(unclassified).toEqual([])
  })

  it('describes every documented code except the reserved ones', () => {
    const undescribed = DOCUMENTED_RETURN_CODES.filter(
      (code) =>
        !RESERVED.has(code) &&
        describeReturnCode(code).startsWith('Device error')
    )

    expect(undescribed).toEqual([])
  })

  describe('the classifications that change behaviour', () => {
    it('never retries a malformed callback URL', () => {
      // -618 is the device rejecting OUR webhook URL. Retrying it forever
      // would bury a configuration error behind an infinite backoff.
      expect(classifyReturnCode(-618)).toBe(ReturnCodeClass.Permanent)
      expect(describeReturnCode(-618)).toContain('callback URL')
    })

    it('escalates a failed remote restart rather than retrying it', () => {
      // The direct answer to our own reboot command. Somebody has to
      // power-cycle the reader at the door.
      expect(classifyReturnCode(-615)).toBe(ReturnCodeClass.NeedsAttention)
    })

    it('escalates a device that is out of memory', () => {
      expect(classifyReturnCode(-604)).toBe(ReturnCodeClass.NeedsAttention)
    })

    it('does not retry table-structure errors, which are malformed requests', () => {
      for (const code of [-100, -101, -102, -103, -106, -107, -108]) {
        expect(classifyReturnCode(code)).toBe(ReturnCodeClass.Permanent)
      }
    })

    it('does retry transfer-integrity failures, which may succeed next time', () => {
      // Corrupted bytes can arrive clean on the retry — unlike a malformed
      // request, which will be just as malformed.
      for (const code of [-4, -5, -6, -9, -10, -19]) {
        expect(classifyReturnCode(code)).toBe(ReturnCodeClass.Retryable)
      }
    })

    it('does not retry operations we never perform', () => {
      // File and firmware-upgrade codes. If one appears against a command we
      // actually sent, no retry addresses it.
      for (const code of [-15, -16, -17, -21, -22, -23, -24, -25]) {
        expect(classifyReturnCode(code)).toBe(ReturnCodeClass.Permanent)
      }
    })

    it('keeps the reserved codes on the bounded-retry default', () => {
      for (const code of RESERVED) {
        expect(classifyReturnCode(code)).toBe(ReturnCodeClass.Retryable)
      }
    })
  })
})

describe('event-code table coverage', () => {
  it('transcribes the vendor table at its documented size', () => {
    // Pins the transcription itself. The previous version of this file was
    // silently 38 codes short, so the count is asserted before anything is
    // asserted *about* the codes.
    expect(DOCUMENTED_EVENT_CODES).toHaveLength(165)
    expect(new Set(DOCUMENTED_EVENT_CODES).size).toBe(165)
    for (const absent of [46, 238, 253]) {
      expect(DOCUMENTED_EVENT_CODES).not.toContain(absent)
    }
  })

  it('files each code under exactly one kind, so the log filters partition it', () => {
    // `codesForKind` is pushed to the database as an `IN (...)` so the check-in
    // log can paginate. A code in two kinds double-counts; a code in none is
    // invisible to every filter while still appearing under All.
    const seen = new Map<number, DeviceEventKind[]>()

    for (const kind of [
      DeviceEventKind.Granted,
      DeviceEventKind.Denied,
      DeviceEventKind.Alarm,
      DeviceEventKind.System,
    ]) {
      for (const code of codesForKind(kind)) {
        seen.set(code, [...(seen.get(code) ?? []), kind])
      }
    }

    expect([...seen].filter(([, kinds]) => kinds.length > 1)).toEqual([])

    // And nothing invented: every classified code exists in the vendor table.
    const documented = new Set(DOCUMENTED_EVENT_CODES)
    expect([...seen.keys()].filter((c) => !documented.has(c))).toEqual([])
  })

  it('classifies every documented event code', () => {
    const unclassified = DOCUMENTED_EVENT_CODES.filter(
      (code) => classifyDeviceEvent(code) === DeviceEventKind.Other
    )

    expect(unclassified).toEqual([])
  })

  it('gives every documented code language a gym manager can read', () => {
    for (const code of DOCUMENTED_EVENT_CODES) {
      const text = describeDeviceEvent(code)

      expect(text.length).toBeGreaterThan(0)
      // Never a bare number on a gym-facing screen (rule 2.9).
      expect(text).not.toMatch(/^\d+$/)
    }
  })

  describe('the classifications that reach a gym manager', () => {
    it('treats the three merged expiry codes as refusals', () => {
      // 29/33/53 are the same event on card, fingerprint and password — and
      // they are what an unpaid member actually produces at the door.
      for (const code of [29, 33, 53]) {
        expect(classifyDeviceEvent(code)).toBe(DeviceEventKind.Denied)
        expect(describeDeviceEvent(code)).toContain('expired')
      }
    })

    it('treats the three merged time-period codes as refusals', () => {
      for (const code of [21, 35, 49]) {
        expect(classifyDeviceEvent(code)).toBe(DeviceEventKind.Denied)
      }
    })

    it('treats multi-user verification waits as refusals, not successes', () => {
      // 26/32/51 mean the door did NOT open — it is waiting for a second
      // person. Classifying these as granted would log an entry that never
      // happened.
      for (const code of [26, 32, 51]) {
        expect(classifyDeviceEvent(code)).toBe(DeviceEventKind.Denied)
      }
    })

    it('never buries a duress alarm', () => {
      for (const code of [101, 103]) {
        expect(classifyDeviceEvent(code)).toBe(DeviceEventKind.Alarm)
        expect(describeDeviceEvent(code)).toContain('Duress')
      }
    })

    it('classifies the extended-event escape hatch rather than leaving it unknown', () => {
      // 254 announces an extended event number, because 0-253 ran out. A
      // firmware that starts using it must not fill a gym's log with "Other".
      expect(classifyDeviceEvent(254)).toBe(DeviceEventKind.System)
    })
  })
})
