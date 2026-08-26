/**
 * Pure, timezone-safe date/bucket helpers for member analytics.
 *
 * All dates are handled as `YYYY-MM-DD` strings in UTC. Because the format is
 * fixed-width and zero-padded, chronological comparison is just string
 * comparison (`a <= b`), which the aggregation code relies on heavily. Every
 * helper here is pure and unit-tested.
 */

import type { AnalyticsRange, Granularity } from '../types'
import {
  MAX_RANGE_MONTHLY_LIMIT,
  MONTH_LABELS_SHORT,
} from '../config/AnalyticsConfig'

/** Normalize any ISO/timestamp string to a `YYYY-MM-DD` date key. */
export function toDateKey(input: string): string {
  return input.slice(0, 10)
}

function parse(iso: string): Date {
  return new Date(`${toDateKey(iso)}T00:00:00.000Z`)
}

function format(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Add (or subtract) whole days, returning a `YYYY-MM-DD` string. */
export function addDays(iso: string, days: number): string {
  const d = parse(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return format(d)
}

/** Add (or subtract) whole months, clamping to the last day of the target month. */
export function addMonths(iso: string, months: number): string {
  const d = parse(iso)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)
  ).getUTCDate()
  d.setUTCDate(Math.min(day, lastDay))
  return format(d)
}

/** First day of the month for the given date. */
export function startOfMonth(iso: string): string {
  return `${toDateKey(iso).slice(0, 7)}-01`
}

/** Last day of the month for the given date. */
export function endOfMonth(iso: string): string {
  const d = parse(iso)
  return format(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)))
}

/** The earlier of two date keys. */
export function minDate(a: string, b: string): string {
  return toDateKey(a) <= toDateKey(b) ? toDateKey(a) : toDateKey(b)
}

/** The later of two date keys. */
export function maxDate(a: string, b: string): string {
  return toDateKey(a) >= toDateKey(b) ? toDateKey(a) : toDateKey(b)
}

/** Whole months between two date keys (calendar difference, ignoring day). */
export function monthsBetween(startIso: string, endIso: string): number {
  const a = parse(startOfMonth(startIso))
  const b = parse(startOfMonth(endIso))
  return (
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
    (b.getUTCMonth() - a.getUTCMonth())
  )
}

/** The bucket key a date falls into for a given granularity. */
export function bucketKey(iso: string, granularity: Granularity): string {
  const key = toDateKey(iso)
  if (granularity === 'day') return key
  if (granularity === 'month') return key.slice(0, 7)
  return key.slice(0, 4)
}

/** Human-readable x-axis label for a bucket key. */
export function bucketLabel(key: string, granularity: Granularity): string {
  if (granularity === 'year') return key
  if (granularity === 'month') {
    const [year, month] = key.split('-')
    return `${MONTH_LABELS_SHORT[Number(month) - 1]} ${year.slice(2)}`
  }
  const [, month, day] = key.split('-')
  return `${day} ${MONTH_LABELS_SHORT[Number(month) - 1]}`
}

/** The [start, end] date-key bounds of a bucket. */
export function bucketPeriod(
  key: string,
  granularity: Granularity
): { start: string; end: string } {
  if (granularity === 'day') return { start: key, end: key }
  if (granularity === 'month') {
    const start = `${key}-01`
    return { start, end: endOfMonth(start) }
  }
  return { start: `${key}-01-01`, end: `${key}-12-31` }
}

/** Inclusive list of every bucket key between start and end, ascending. */
export function enumerateBuckets(
  startIso: string,
  endIso: string,
  granularity: Granularity
): string[] {
  const keys: string[] = []
  const step =
    granularity === 'day'
      ? (d: string) => addDays(d, 1)
      : granularity === 'month'
        ? (d: string) => addMonths(d, 1)
        : (d: string) => addMonths(d, 12)

  const endKey = bucketKey(endIso, granularity)
  let cursor = toDateKey(startIso)
  // Guard against pathological ranges (should never spin, but stay bounded).
  let guard = 0
  while (bucketKey(cursor, granularity) <= endKey && guard < 5000) {
    keys.push(bucketKey(cursor, granularity))
    cursor = step(cursor)
    guard += 1
  }
  return keys
}

export interface AnalyticsWindow {
  startIso: string
  endIso: string
  granularity: Granularity
}

/**
 * Resolve a stock-chart range selection into a concrete [start, end] window and
 * the bucket granularity to plot at. Trailing ranges are clamped so they never
 * start before the gym existed; an explicitly chosen calendar year (`1Y`) is
 * left as picked (only its end is clamped to today).
 */
export function resolveAnalyticsWindow(
  range: AnalyticsRange,
  year: number,
  todayIso: string,
  gymCreatedIso: string
): AnalyticsWindow {
  const today = toDateKey(todayIso)
  const gymCreated = toDateKey(gymCreatedIso)
  const thisYear = today.slice(0, 4)

  switch (range) {
    case '1M':
      return {
        startIso: maxDate(gymCreated, addDays(today, -29)),
        endIso: today,
        granularity: 'day',
      }
    case '3M':
      return {
        startIso: maxDate(gymCreated, addDays(today, -89)),
        endIso: today,
        granularity: 'day',
      }
    case 'YTD':
      return {
        startIso: maxDate(gymCreated, `${thisYear}-01-01`),
        endIso: today,
        granularity: 'month',
      }
    case '1Y':
      return {
        startIso: `${year}-01-01`,
        endIso: minDate(today, `${year}-12-31`),
        granularity: 'month',
      }
    case 'MAX':
    default: {
      const span = monthsBetween(gymCreated, today)
      return {
        startIso: gymCreated,
        endIso: today,
        granularity: span > MAX_RANGE_MONTHLY_LIMIT ? 'year' : 'month',
      }
    }
  }
}
