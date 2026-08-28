/**
 * Device event code classification.
 *
 * These codes come from VFT's "Event Codes" reference — vendor-supplied, so
 * unlike most of this integration they are fact rather than assumption.
 *
 * The reason this matters: the device tells us *why* it refused someone. That
 * turns "the door won't let me in" into "refused at 18:42, membership expired"
 * at the front desk.
 */

import {
  classifyDeviceEvent,
  describeDeviceEvent,
  isUrgentEvent,
  toDenialReason,
  DeviceEventKind,
} from '@/features/access-control/config/DeviceEventCodes'
import { AccessDenialReason } from '@/features/access-control/config/AccessControlConfig'

describe('classifyDeviceEvent', () => {
  it.each([
    [0, 'door opens normally after verification'],
    [14, 'opened by fingerprint'],
    [17, 'opened by card and fingerprint'],
    [232, 'passed the verification'],
  ])('treats %i (%s) as granted', (code) => {
    expect(classifyDeviceEvent(code)).toBe(DeviceEventKind.Granted)
  })

  it.each([
    [8, 'remote unlock'],
    [202, 'exit button'],
  ])('counts %i (%s) as granted even with no member involved', (code) => {
    // The door did open. Whether a member was identified is a separate concern.
    expect(classifyDeviceEvent(code)).toBe(DeviceEventKind.Granted)
  })

  it.each([
    [21, 'verification outside the valid period'],
    [29, 'user privilege expired'],
    [34, 'fingerprint not registered'],
    [43, 'user locked'],
  ])('treats %i (%s) as denied', (code) => {
    expect(classifyDeviceEvent(code)).toBe(DeviceEventKind.Denied)
  })

  it.each([
    [100, 'tamper'],
    [101, 'duress password'],
    [103, 'duress fingerprint'],
    [110, 'reader offline'],
  ])('treats %i (%s) as an alarm', (code) => {
    expect(classifyDeviceEvent(code)).toBe(DeviceEventKind.Alarm)
  })

  it.each([
    [105, 'network disconnected'],
    [206, 'device started'],
    [214, 'connected to server'],
  ])('treats %i (%s) as a system event', (code) => {
    expect(classifyDeviceEvent(code)).toBe(DeviceEventKind.System)
  })

  it('does not guess at unmapped codes', () => {
    expect(classifyDeviceEvent(9999)).toBe(DeviceEventKind.Other)
  })
})

describe('toDenialReason', () => {
  /**
   * The vendor table merges codes that differ only by credential type — card
   * vs fingerprint vs password. Our members only ever use a fingerprint, but
   * the device may still report any of them, so all must map identically.
   */
  it.each([21, 35, 49])(
    'maps merged non-valid-period code %i to expired',
    (code) => {
      expect(toDenialReason(code)).toBe(AccessDenialReason.Expired)
    }
  )

  it.each([29, 33, 53])(
    'maps merged privilege-expired code %i to expired',
    (code) => {
      expect(toDenialReason(code)).toBe(AccessDenialReason.Expired)
    }
  )

  it.each([27, 30, 34])(
    'maps merged not-registered code %i to cancelled',
    (code) => {
      // No record on the device: either never enrolled, or removed when the
      // membership was cancelled.
      expect(toDenialReason(code)).toBe(AccessDenialReason.Cancelled)
    }
  )

  it.each([39, 43, 62])('maps blocked-user code %i to suspended', (code) => {
    expect(toDenialReason(code)).toBe(AccessDenialReason.Suspended)
  })

  it('returns null for events that are not membership denials', () => {
    expect(toDenialReason(0)).toBeNull()
    expect(toDenialReason(68)).toBeNull() // temperature check — not our concern
  })
})

describe('describeDeviceEvent', () => {
  it('explains an expired membership in words staff can repeat to a member', () => {
    expect(describeDeviceEvent(29)).toMatch(/expired/i)
  })

  it('never leaks device or firmware jargon', () => {
    // Gym managers see these directly (rules 2.8 / 2.9).
    const codes = [0, 8, 21, 27, 34, 43, 100, 103, 105, 110, 206, 9999]

    for (const code of codes) {
      expect(describeDeviceEvent(code)).not.toMatch(
        /wiegand|APB|interlock|firmware|CRC|0x|null|undefined/i
      )
    }
  })

  it('falls back to a neutral phrase for unmapped codes', () => {
    expect(describeDeviceEvent(9999)).toBe('Reader event')
  })
})

describe('isUrgentEvent', () => {
  it('flags duress, which must never sit unnoticed in a log', () => {
    expect(isUrgentEvent(101)).toBe(true)
    expect(isUrgentEvent(103)).toBe(true)
  })

  it('flags tampering and a reader going offline', () => {
    expect(isUrgentEvent(100)).toBe(true)
    expect(isUrgentEvent(110)).toBe(true)
  })

  it('does not flag ordinary entries or refusals', () => {
    expect(isUrgentEvent(0)).toBe(false)
    expect(isUrgentEvent(21)).toBe(false)
  })
})

/**
 * The classifications that were wrong, kept as named cases.
 *
 * Whole-table coverage lives in `lib/access-control/__tests__/vendorTables.test.ts`
 * and is not repeated here. These four are the ones a person would notice.
 */
describe('the gaps found against the vendor table', () => {
  it('counts verification while the exit button is open as an entry', () => {
    // 219 is a real entry. Unclassified, it appeared under the check-in log's
    // All view and under none of its filters.
    expect(classifyDeviceEvent(219)).toBe(DeviceEventKind.Granted)
    expect(describeDeviceEvent(219)).toBe('Entry allowed')
  })

  it('counts an unfinished combined verification as a refusal', () => {
    expect(classifyDeviceEvent(75)).toBe(DeviceEventKind.Denied)
    expect(describeDeviceEvent(75)).toMatch(/refused/i)
  })

  it('alarms on a fire-alarm wiring fault, but not on ordinary wiring detection', () => {
    for (const code of [114, 115, 243, 244]) {
      expect(classifyDeviceEvent(code)).toBe(DeviceEventKind.Alarm)
      expect(isUrgentEvent(code)).toBe(true)
    }

    // Exit button, auxiliary input and door sensor faults are real and worth
    // seeing, but none of them stops a paid member getting in.
    for (const code of [116, 117, 118, 119, 120, 121]) {
      expect(classifyDeviceEvent(code)).toBe(DeviceEventKind.System)
      expect(isUrgentEvent(code)).toBe(false)
    }
  })

  it('never tells staff an elevator button was an entry refusal', () => {
    // 80 is a refusal in the vendor table — of a floor-selection button, on
    // hardware a gym does not have. Showing "Entry refused" would be a lie.
    expect(classifyDeviceEvent(80)).toBe(DeviceEventKind.System)
    expect(describeDeviceEvent(80)).not.toMatch(/refused/i)
  })
})
