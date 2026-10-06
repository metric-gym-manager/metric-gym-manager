import {
  SEND_WINDOW,
  SRI_LANKA_UTC_OFFSET_MINUTES,
} from '../config/AnnouncementConfig'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/**
 * The first moment at or after `earliest` that falls inside the send window
 * in Sri Lanka (`SEND_WINDOW`); outside it, 09:30 the same morning or the
 * next. Never earlier than asked.
 *
 * @param earliest - When the hold ends
 * @returns When the gyms get the email
 *
 * @example
 * nextSendTime(new Date('2026-10-07T18:00:00Z')) // 2026-10-08T04:00:00Z (09:30 SLT)
 */
export function nextSendTime(earliest: Date): Date {
  const offset = SRI_LANKA_UTC_OFFSET_MINUTES * MINUTE
  const local = earliest.getTime() + offset
  const dayStart = Math.floor(local / DAY) * DAY
  const minutes = (local - dayStart) / MINUTE
  if (minutes >= SEND_WINDOW.opens && minutes < SEND_WINDOW.closes) {
    return earliest
  }
  const morning = dayStart + SEND_WINDOW.fallback * MINUTE
  const target = minutes < SEND_WINDOW.opens ? morning : morning + DAY
  return new Date(target - offset)
}
