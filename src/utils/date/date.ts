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
  } catch {
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
  } catch {
    return 'Invalid Date';
  }
}

/**
 * Calculate next due date based on payment date and plan type.
 * Mirrors backend logic from payment.service.ts
 *
 * @param paymentDate - Payment date in YYYY-MM-DD format
 * @param planType - Plan type ('daily' | 'weekly' | 'monthly' | '3-months' | '6-months' | 'annual')
 * @returns Next due date in YYYY-MM-DD format
 *
 * @example
 * calculateNextDueDate('2026-03-15', 'monthly') // "2026-04-15"
 * calculateNextDueDate('2026-03-15', 'daily') // "2026-03-16"
 * calculateNextDueDate('2026-03-15', 'annual') // "2027-03-15"
 */
export function calculateNextDueDate(
  paymentDate: string,
  planType: string
): string {
  const date = new Date(paymentDate);

  switch (planType) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case '3-months':
      date.setMonth(date.getMonth() + 3);
      break;
    case '6-months':
      date.setMonth(date.getMonth() + 6);
      break;
    case 'annual':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return date.toISOString().split('T')[0];
}
