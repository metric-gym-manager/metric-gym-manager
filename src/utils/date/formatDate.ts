/**
 * Date formatting utilities
 *
 * Centralized date formatting for consistent display across the application.
 */

/**
 * Format date for database storage (YYYY-MM-DD)
 *
 * @param date - The date to format
 * @returns Date string in YYYY-MM-DD format
 *
 * @example
 * formatDateForDB(new Date('2024-01-15'))
 * // Returns: '2024-01-15'
 */
export function formatDateForDB(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format date for display (DD/MM/YYYY)
 *
 * @param date - The date to format (Date object or ISO string)
 * @returns Date string in DD/MM/YYYY format
 *
 * @example
 * formatDateForDisplay(new Date('2024-01-15'))
 * // Returns: '15/01/2024'
 *
 * @example
 * formatDateForDisplay('2024-01-15')
 * // Returns: '15/01/2024'
 */
export function formatDateForDisplay(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB'); // DD/MM/YYYY format
}

/**
 * Format date for display (US format: MM/DD/YYYY)
 *
 * @param date - The date to format (Date object or ISO string)
 * @returns Date string in MM/DD/YYYY format
 */
export function formatDateForDisplayUS(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US'); // MM/DD/YYYY format
}

/**
 * Format date with time for display
 *
 * @param date - The date to format (Date object or ISO string)
 * @returns Date and time string
 *
 * @example
 * formatDateTimeForDisplay(new Date('2024-01-15T14:30:00'))
 * // Returns: '15/01/2024, 14:30:00'
 */
export function formatDateTimeForDisplay(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-GB'); // DD/MM/YYYY, HH:MM:SS format
}

/**
 * Get relative time string (e.g., "2 days ago", "in 3 days")
 *
 * @param date - The date to format
 * @returns Relative time string
 *
 * @example
 * formatRelativeTime(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000))
 * // Returns: '2 days ago'
 *
 * @example
 * formatRelativeTime(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))
 * // Returns: 'in 3 days'
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'today';
  } else if (diffDays === 1) {
    return 'tomorrow';
  } else if (diffDays === -1) {
    return 'yesterday';
  } else if (diffDays > 1) {
    return `in ${diffDays} days`;
  } else {
    return `${Math.abs(diffDays)} days ago`;
  }
}

/**
 * Parse date from various formats
 *
 * @param dateString - The date string to parse
 * @returns Parsed Date object
 */
export function parseDate(dateString: string): Date {
  // Try ISO format first
  let date = new Date(dateString);

  // If invalid, try DD/MM/YYYY format
  if (isNaN(date.getTime())) {
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
  }

  return date;
}
