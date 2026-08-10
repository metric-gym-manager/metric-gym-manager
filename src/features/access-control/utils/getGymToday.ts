/**
 * Gym-local calendar day.
 *
 * Access decisions are calendar-day comparisons, and the terminal enforces the
 * expiry cutover at *its* local midnight. Computing "today" from server-local
 * time would move the boundary — this app runs on Vercel (UTC), so a naive
 * `new Date()` puts the boundary 5.5 hours late for Sri Lanka.
 *
 * Pure and dependency-free. Feature-local for now (R8: a single-feature helper
 * is not promoted to `src/utils/` speculatively); it is the natural thing to
 * promote if the app-wide date arithmetic is ever made timezone-aware.
 */

import { GYM_TIMEZONE } from '@/features/access-control/config/AccessControlConfig'

/**
 * The calendar date in the gym's timezone, as a UTC-midnight `Date`.
 *
 * Returning UTC midnight (rather than local midnight) keeps the value a pure
 * calendar day: comparisons and `YYYYMMDD` formatting are then unaffected by
 * whatever timezone the process happens to run in.
 *
 * @param now - Instant to evaluate. Defaults to the current time.
 * @returns Midnight UTC on the gym-local calendar date.
 *
 * @example
 * // Process in UTC, real time 2026-01-15T20:30:00Z.
 * // Sri Lanka (UTC+5:30) is already on the 16th.
 * getGymToday(new Date('2026-01-15T20:30:00Z')) // => 2026-01-16T00:00:00Z
 */
export function getGymToday(now: Date = new Date()): Date {
  return toGymDate(now)
}

/**
 * Convert an instant to the gym-local calendar date it falls on.
 *
 * Uses `Intl` rather than a fixed offset so the rule survives a timezone
 * change. Sri Lanka has no DST today, but hardcoding +5:30 would silently
 * break if that ever changed or if the platform serves another region.
 *
 * @param instant - The instant to convert.
 * @returns Midnight UTC on the gym-local calendar date.
 */
export function toGymDate(instant: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: GYM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)

  // en-CA formats as YYYY-MM-DD, which parses as UTC midnight.
  return new Date(`${parts}T00:00:00.000Z`)
}

/**
 * Strip the time component from a date already known to be a calendar day.
 *
 * Used for values that come out of the database as `DATE` columns, where the
 * timezone conversion above would be wrong — a stored `2026-01-15` means that
 * calendar day, not an instant to be re-interpreted.
 *
 * @param date - Date whose calendar day should be isolated.
 * @returns Midnight UTC on the same calendar day.
 */
export function toCalendarDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
}

/**
 * Format a calendar day as the `YYYYMMDD` string ZKTeco terminals expect for
 * `StartDate` / `EndDate`.
 *
 * @param date - The calendar day.
 * @returns Eight-digit date string, e.g. `20260115`.
 */
export function formatDeviceDate(date: Date): string {
  const day = toCalendarDay(date)
  const year = day.getUTCFullYear().toString().padStart(4, '0')
  const month = (day.getUTCMonth() + 1).toString().padStart(2, '0')
  const dayOfMonth = day.getUTCDate().toString().padStart(2, '0')
  return `${year}${month}${dayOfMonth}`
}

/**
 * Add whole days to a calendar day.
 *
 * @param date - Starting calendar day.
 * @param days - Days to add (may be negative).
 * @returns The resulting calendar day at UTC midnight.
 */
export function addDays(date: Date, days: number): Date {
  const day = toCalendarDay(date)
  day.setUTCDate(day.getUTCDate() + days)
  return day
}
