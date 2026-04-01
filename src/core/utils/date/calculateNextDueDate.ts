/**
 * Centralized date calculation utility
 *
 * This is the SINGLE SOURCE OF TRUTH for calculating next due dates.
 * Extracted from:
 * - src/features/members/services/member.service.ts (lines 175-194)
 * - src/features/members/services/payment.service.ts (lines 131-150)
 * - src/components/members/PaymentCollectionModal.tsx (lines 153-163) [BUGGY VERSION]
 *
 * CRITICAL: This handles variable month lengths correctly:
 * - Jan 31 + 1 month = Feb 28/29 (not Mar 2!)
 * - Feb 29 + 1 year = Feb 28 in non-leap year
 */

import { PlanType, PLAN_CONFIGS } from '../constants/PlanConfig';

export interface CalculateNextDueDateOptions {
  /**
   * If true, calculate from startDate (deduct overdue period)
   * If false, calculate from current next due date (preserve grace period)
   * Default: true
   */
  deductOverduePeriod?: boolean;
}

/**
 * Calculate the next due date for a membership plan
 *
 * @param startDate - The date to calculate from (either payment date or current due date)
 * @param planType - The type of membership plan
 * @param options - Calculation options
 * @returns The calculated next due date
 *
 * @example
 * // Registration: Calculate from membership start date
 * const nextDue = calculateNextDueDate(new Date('2024-01-15'), 'monthly');
 * // Result: 2024-02-15
 *
 * @example
 * // Payment collection: Calculate from payment date (deduct overdue)
 * const nextDue = calculateNextDueDate(new Date('2024-02-20'), 'monthly', { deductOverduePeriod: true });
 * // Result: 2024-03-20
 *
 * @example
 * // Payment collection: Calculate from current due date (preserve grace period)
 * const currentDue = new Date('2024-02-15');
 * const nextDue = calculateNextDueDate(currentDue, 'monthly', { deductOverduePeriod: false });
 * // Result: 2024-03-15 (preserves original schedule)
 */
/**
 * Add months to a date, handling month overflow correctly
 *
 * JavaScript's setMonth() causes overflow issues:
 * - Jan 31 + 1 month → Mar 2 (WRONG!)
 *
 * This function handles it correctly:
 * - Jan 31 + 1 month → Feb 28/29 (clamp to last day of target month)
 *
 * @param date - The starting date
 * @param months - Number of months to add
 * @returns New date with months added
 */
function addMonthsSafe(date: Date, months: number): Date {
  const result = new Date(date);
  const originalDay = result.getDate();

  // Move to first of month to avoid overflow during setMonth
  result.setDate(1);
  result.setMonth(result.getMonth() + months);

  // Get last day of target month
  const lastDayOfMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  // Set day to original day or last day of month, whichever is smaller
  result.setDate(Math.min(originalDay, lastDayOfMonth));

  return result;
}

/**
 * Add years to a date, handling leap year correctly
 *
 * Feb 29, 2024 + 1 year → Feb 28, 2025 (not Mar 1!)
 *
 * @param date - The starting date
 * @param years - Number of years to add
 * @returns New date with years added
 */
function addYearsSafe(date: Date, years: number): Date {
  const result = new Date(date);
  const originalDay = result.getDate();
  const originalMonth = result.getMonth();

  // Set to first of month to avoid overflow
  result.setDate(1);
  result.setFullYear(result.getFullYear() + years);

  // Get last day of target month in target year
  const lastDayOfMonth = new Date(
    result.getFullYear(),
    originalMonth + 1,
    0
  ).getDate();

  // Restore month and set day
  result.setMonth(originalMonth);
  result.setDate(Math.min(originalDay, lastDayOfMonth));

  return result;
}

export function calculateNextDueDate(
  startDate: Date,
  planType: PlanType | string,
  _options: CalculateNextDueDateOptions = {}
): Date {
  // Get plan configuration
  const config = PLAN_CONFIGS[planType as PlanType];

  // Handle custom plans (default to monthly behavior)
  if (!config) {
    return addMonthsSafe(startDate, 1);
  }

  // Create new Date to avoid mutating input
  const result = new Date(startDate);

  switch (config.durationMethod) {
    case 'day':
      result.setDate(result.getDate() + config.durationValue);
      return result;

    case 'month':
      return addMonthsSafe(startDate, config.durationValue);

    case 'year':
      return addYearsSafe(startDate, config.durationValue);

    default:
      throw new Error(`Invalid duration method for plan type: ${planType}`);
  }
}

/**
 * Calculate next due date from payment date
 *
 * This is a convenience wrapper for payment collection scenarios.
 *
 * @param paymentDate - The date payment was made
 * @param currentDueDate - The current next due date
 * @param planType - The type of membership plan
 * @param deductOverduePeriod - Whether to deduct overdue period
 * @returns The calculated next due date
 */
export function calculateNextDueDateFromPayment(
  paymentDate: Date,
  currentDueDate: Date,
  planType: PlanType,
  deductOverduePeriod: boolean = true
): Date {
  const baseDate = deductOverduePeriod ? paymentDate : currentDueDate;
  return calculateNextDueDate(baseDate, planType, { deductOverduePeriod });
}

/**
 * Format date for database storage (YYYY-MM-DD)
 *
 * @param date - The date to format
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateForDB(date: Date): string {
  return date.toISOString().split('T')[0];
}
