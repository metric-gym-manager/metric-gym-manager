/**
 * Calculate days until due date
 *
 * This utility calculates the number of days remaining until a due date.
 * Positive values indicate future dates, negative values indicate overdue dates.
 *
 * Extracted from:
 * - src/features/sms/services/reminder.service.ts (lines 241-244)
 * - Used in multiple locations for reminder logic
 */

/**
 * Calculate the number of days until a due date
 *
 * @param dueDate - The due date to calculate from
 * @returns Number of days until due (negative if overdue)
 *
 * @example
 * // Due in 3 days
 * const days = getDaysUntilDue(new Date('2024-01-18'));
 * // If today is 2024-01-15, returns: 3
 *
 * @example
 * // Overdue by 2 days
 * const days = getDaysUntilDue(new Date('2024-01-13'));
 * // If today is 2024-01-15, returns: -2
 */
export function getDaysUntilDue(dueDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Check if a date is overdue
 *
 * @param dueDate - The due date to check
 * @returns True if the date is in the past
 */
export function isOverdue(dueDate: Date): boolean {
  return getDaysUntilDue(dueDate) < 0;
}

/**
 * Check if a date is due today
 *
 * @param dueDate - The due date to check
 * @returns True if the date is today
 */
export function isDueToday(dueDate: Date): boolean {
  return getDaysUntilDue(dueDate) === 0;
}

/**
 * Check if a date is within a certain number of days
 *
 * @param dueDate - The due date to check
 * @param days - Number of days to check within
 * @returns True if due within the specified days
 *
 * @example
 * isDueWithinDays(dueDate, 7) // Due within 7 days
 * isDueWithinDays(dueDate, 3) // Due within 3 days
 */
export function isDueWithinDays(dueDate: Date, days: number): boolean {
  const daysUntil = getDaysUntilDue(dueDate);
  return daysUntil >= 0 && daysUntil <= days;
}
