/**
 * Date formatting utilities for consistent date display across the application.
 * Uses human-readable format (DD MMM YYYY) to avoid DD/MM vs MM/DD confusion.
 */

/**
 * Formats a date string or Date object to "DD MMM YYYY" format (e.g., "03 Dec 2026")
 *
 * @param dateInput - ISO date string, date string, or Date object
 * @returns Formatted date string in "DD MMM YYYY" format
 *
 * @example
 * formatDate('2026-03-12') // "12 Mar 2026"
 * formatDate('2026-12-03T10:30:00Z') // "03 Dec 2026"
 * formatDate(new Date('2026-03-12')) // "12 Mar 2026"
 */
export function formatDate(dateInput: string | Date): string {
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid Date'
    }

    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      // A bare YYYY-MM-DD is a calendar day, parsed as UTC midnight: print it
      // in UTC or a browser west of UTC shows the day before. Timestamps and
      // Date objects keep the browser's own zone.
      timeZone: isCalendarDay(dateInput) ? 'UTC' : undefined,
    })
  } catch {
    return 'Invalid Date'
  }
}

/** A `YYYY-MM-DD` string with no time: a calendar day, not an instant. */
function isCalendarDay(dateInput: string | Date): boolean {
  return typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
}

/**
 * Formats a timestamp as the product date plus a 24-hour local time,
 * e.g. "05 Oct 2026, 09:00".
 *
 * `formatDate` for the date so the product has one date producer, and an
 * explicit `en-GB` 24-hour time beside it rather than a browser-locale guess
 * (`toLocaleString()` printed `9/24/2026, 8:41:00 AM`).
 *
 * @param iso - ISO timestamp.
 * @returns Formatted date and time, or "Unknown" if the value is not a date.
 *
 * @example
 * formatDateTime('2026-10-05T03:30:00Z') // "05 Oct 2026, 09:00" in Sri Lanka
 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  const time = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${formatDate(date)}, ${time}`
}

/**
 * Formats a date string or Date object to "DD MMM" format (e.g., "03 Dec")
 * Useful for compact date displays without the year.
 *
 * @param dateInput - ISO date string, date string, or Date object
 * @returns Formatted date string in "DD MMM" format
 *
 * @example
 * formatDateShort('2026-03-12') // "12 Mar"
 * formatDateShort('2026-12-03T10:30:00Z') // "03 Dec"
 */
export function formatDateShort(dateInput: string | Date): string {
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid Date'
    }

    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    })
  } catch {
    return 'Invalid Date'
  }
}

/**
 * Format date for display in en-GB (DD/MM/YYYY) format.
 * Used by server-side use-cases for SMS message dates.
 *
 * @example
 * formatDateForDisplay(new Date('2024-01-15')) // '15/01/2024'
 */
export function formatDateForDisplay(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-GB') // DD/MM/YYYY format
}
