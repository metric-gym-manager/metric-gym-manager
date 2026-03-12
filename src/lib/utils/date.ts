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
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch (error) {
    return 'Invalid Date';
  }
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
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });
  } catch (error) {
    return 'Invalid Date';
  }
}
