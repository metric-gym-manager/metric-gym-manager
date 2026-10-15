/**
 * Finger slots (visit 2, CD-1).
 *
 * The map is the ZKTeco standard, confirmed on the readers: a left thumb
 * enrolled at the menu came back as slot 4 and a right thumb as slot 5 (PH-25).
 * Every enrolment used slot 0 before, so a second finger replaced the first.
 */

import {
  DEFAULT_FINGER_SLOT,
  FINGER_SLOTS,
} from '@/features/access-control/config/AccessControlConfig'

describe('FINGER_SLOTS', () => {
  it('covers exactly the slots 0 to 9, in order', () => {
    expect(FINGER_SLOTS.map((slot) => slot.id)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ])
  })

  it('gives every slot a unique key and a label', () => {
    const keys = FINGER_SLOTS.map((slot) => slot.key)

    expect(new Set(keys).size).toBe(FINGER_SLOTS.length)
    for (const slot of FINGER_SLOTS) {
      expect(slot.label.length).toBeGreaterThan(0)
    }
  })

  it('puts the left thumb in slot 4 and the right thumb in slot 5', () => {
    const byKey = Object.fromEntries(FINGER_SLOTS.map((s) => [s.key, s.id]))

    expect(byKey['left-thumb']).toBe(4)
    expect(byKey['right-thumb']).toBe(5)
  })

  it('defaults to the right index finger', () => {
    const slot = FINGER_SLOTS.find((s) => s.id === DEFAULT_FINGER_SLOT)

    expect(slot?.key).toBe('right-index')
  })
})
