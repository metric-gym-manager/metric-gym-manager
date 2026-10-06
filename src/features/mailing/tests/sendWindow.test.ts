/**
 * @jest-environment node
 */
import { nextSendTime } from '../utils/sendWindow'

/**
 * Inverted check, 2026-10-06. The release workflow triggers an announcement
 * minutes after a deploy, and the gyms got it exactly 24 hours later — so a
 * release merged at 23:30 Sri Lanka time reached every gym owner at 23:30 the
 * next night. Sends now land inside office hours in Sri Lanka (UTC+05:30, no
 * daylight saving).
 */
const at = (iso: string) => nextSendTime(new Date(iso)).toISOString()

describe('nextSendTime', () => {
  it('leaves a time inside 09:00–19:00 Sri Lanka time alone', () => {
    expect(at('2026-10-07T10:40:00.000Z')).toBe('2026-10-07T10:40:00.000Z') // 16:10
    expect(at('2026-10-07T04:00:00.000Z')).toBe('2026-10-07T04:00:00.000Z') // 09:30, the daily run
    expect(at('2026-10-07T03:30:00.000Z')).toBe('2026-10-07T03:30:00.000Z') // 09:00 sharp
  })

  it('moves an evening time to 09:30 the next morning', () => {
    expect(at('2026-10-07T18:00:00.000Z')).toBe('2026-10-08T04:00:00.000Z') // 23:30 → 09:30
    expect(at('2026-10-07T13:30:00.000Z')).toBe('2026-10-08T04:00:00.000Z') // 19:00 sharp
  })

  it('moves an early-morning time to 09:30 the same morning', () => {
    expect(at('2026-10-06T21:30:00.000Z')).toBe('2026-10-07T04:00:00.000Z') // 03:00 on the 7th
    expect(at('2026-10-07T03:29:00.000Z')).toBe('2026-10-07T04:00:00.000Z') // 08:59
  })

  it('never moves a send earlier than it was asked for', () => {
    for (let hour = 0; hour < 24; hour++) {
      const earliest = new Date(Date.UTC(2026, 9, 7, hour, 15))
      expect(nextSendTime(earliest).getTime()).toBeGreaterThanOrEqual(
        earliest.getTime()
      )
    }
  })
})
