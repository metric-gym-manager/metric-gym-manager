import { describe, expect, it } from 'vitest'
import { EVENTS, hhmm, minutesAt, DURATION } from './timeline'

describe('Overnight clock', () => {
  it('shows each event at its real scheduled time on the frame it fires', () => {
    for (const e of EVENTS) expect(hhmm(minutesAt(e.at))).toBe(e.time)
  })

  it('never runs backwards', () => {
    for (let f = 1; f < DURATION; f++) expect(minutesAt(f)).toBeGreaterThanOrEqual(minutesAt(f - 1))
  })

  it('runs from closing (21:00) to the owner opening the laptop (09:05)', () => {
    expect(hhmm(minutesAt(0))).toBe('21:00')
    expect(hhmm(minutesAt(DURATION - 1))).toBe('09:05')
  })

  it('uses the product schedule: 05:30, 06:00, 09:00', () => {
    expect(EVENTS.map((e) => e.time)).toEqual(['05:30', '06:00', '09:00'])
  })
})
