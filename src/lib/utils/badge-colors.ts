/**
 * Badge color utilities for consistent, WCAG AA-compliant badge styling.
 * Provides semantic color mappings for plan types and member statuses.
 */

/**
 * WCAG AA-compliant color classes for membership plan type badges.
 * Colors are ordered by plan duration (daily → annual) with increasing color depth.
 */
export const PLAN_BADGE_COLORS = {
  daily: 'bg-orange-100 text-orange-800 border-orange-200',
  weekly: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  monthly: 'bg-blue-100 text-blue-800 border-blue-200',
  '3-months': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  '6-months': 'bg-purple-100 text-purple-800 border-purple-200',
  annual: 'bg-green-100 text-green-800 border-green-200',
} as const;

/**
 * Semantic color classes for member status badges.
 * - Active: Green (positive, good to go)
 * - Expired: Red (urgent action needed)
 * - Frozen: Gray (paused, neutral)
 * - Cancelled: Orange (warning, permanent)
 */
export const STATUS_BADGE_COLORS = {
  active: 'bg-green-100 text-green-800 border-green-200',
  expired: 'bg-red-100 text-red-800 border-red-200',
  frozen: 'bg-gray-100 text-gray-800 border-gray-200',
  cancelled: 'bg-orange-100 text-orange-800 border-orange-200',
} as const;

/**
 * Type definitions for badge color keys
 */
export type PlanType = keyof typeof PLAN_BADGE_COLORS;
export type StatusType = keyof typeof STATUS_BADGE_COLORS;

/**
 * Get badge color classes for a given plan type.
 * Returns default gray color for unknown plan types.
 *
 * @param planType - The membership plan type
 * @returns Tailwind CSS classes for badge styling
 *
 * @example
 * <Badge className={getPlanBadgeColor('monthly')}>Monthly</Badge>
 */
export function getPlanBadgeColor(planType: PlanType | string): string {
  if (planType in PLAN_BADGE_COLORS) {
    return PLAN_BADGE_COLORS[planType as PlanType];
  }
  return 'bg-gray-100 text-gray-800 border-gray-200'; // Default fallback
}

/**
 * Get badge color classes for a given member status.
 * Returns default gray color for unknown status types.
 *
 * @param status - The member status
 * @returns Tailwind CSS classes for badge styling
 *
 * @example
 * <Badge className={getStatusBadgeColor('active')}>Active</Badge>
 */
export function getStatusBadgeColor(status: StatusType | string): string {
  if (status in STATUS_BADGE_COLORS) {
    return STATUS_BADGE_COLORS[status as StatusType];
  }
  return 'bg-gray-100 text-gray-800 border-gray-200'; // Default fallback
}
