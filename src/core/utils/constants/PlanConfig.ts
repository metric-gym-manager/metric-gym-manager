/**
 * Plan Configuration - Single Source of Truth
 *
 * This file defines all membership plan types and their properties.
 * CRITICAL: This is the ONLY place where plan configurations should be defined.
 */

/**
 * Membership plan types
 */
export enum PlanType {
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly',
  ThreeMonths = '3-months',
  SixMonths = '6-months',
  Annual = 'annual',
  Custom = 'custom',
}

/**
 * Duration calculation method
 */
export type DurationMethod = 'day' | 'month' | 'year';

/**
 * Plan configuration interface
 */
export interface PlanConfiguration {
  /**
   * Approximate duration in days (for reference only)
   */
  readonly durationDays: number;

  /**
   * Method to use for calculating next due date
   * - 'day': Use setDate() with durationValue
   * - 'month': Use setMonth() with durationValue
   * - 'year': Use setFullYear() with durationValue
   */
  readonly durationMethod: DurationMethod;

  /**
   * Value to add to the date
   * - For 'day': number of days
   * - For 'month': number of months
   * - 'year': number of years
   */
  readonly durationValue: number;

  /**
   * Display label
   */
  readonly label: string;

  /**
   * Recommended minimum amount (LKR)
   * This is a suggestion, not enforced
   */
  readonly suggestedMinAmount: number;

  /**
   * Whether this plan supports recurring discounts
   */
  readonly supportsRecurringDiscount: boolean;
}

/**
 * SINGLE SOURCE OF TRUTH for all plan configurations
 *
 * ⚠️ CRITICAL: This is used by:
 * - Date calculation utilities
 * - Reminder configuration
 * - UI dropdowns
 * - Validation schemas
 *
 * DO NOT duplicate these values elsewhere!
 */
export const PLAN_CONFIGS: Readonly<Record<PlanType, PlanConfiguration>> = {
  [PlanType.Daily]: {
    durationDays: 1,
    durationMethod: 'day',
    durationValue: 1,
    label: 'Daily Plan',
    suggestedMinAmount: 100,
    supportsRecurringDiscount: false,
  },

  [PlanType.Weekly]: {
    durationDays: 7,
    durationMethod: 'day',
    durationValue: 7,
    label: 'Weekly Plan',
    suggestedMinAmount: 500,
    supportsRecurringDiscount: true,
  },

  [PlanType.Monthly]: {
    durationDays: 30, // Approximate (actual is variable)
    durationMethod: 'month',
    durationValue: 1,
    label: 'Monthly Plan',
    suggestedMinAmount: 1500,
    supportsRecurringDiscount: true,
  },

  [PlanType.ThreeMonths]: {
    durationDays: 90, // Approximate
    durationMethod: 'month',
    durationValue: 3,
    label: '3-Month Plan',
    suggestedMinAmount: 4000,
    supportsRecurringDiscount: true,
  },

  [PlanType.SixMonths]: {
    durationDays: 180, // Approximate
    durationMethod: 'month',
    durationValue: 6,
    label: '6-Month Plan',
    suggestedMinAmount: 7500,
    supportsRecurringDiscount: true,
  },

  [PlanType.Annual]: {
    durationDays: 365, // Approximate (leap years have 366)
    durationMethod: 'year',
    durationValue: 1,
    label: 'Annual Plan',
    suggestedMinAmount: 14000,
    supportsRecurringDiscount: true,
  },

  [PlanType.Custom]: {
    durationDays: 30, // Default to monthly behavior
    durationMethod: 'month',
    durationValue: 1,
    label: 'Custom Plan',
    suggestedMinAmount: 1000,
    supportsRecurringDiscount: true,
  },
} as const;

/**
 * Get plan configuration by plan type
 *
 * @param planType - The plan type
 * @returns Plan configuration
 * @throws Error if plan type is invalid
 */
export function getPlanConfig(planType: PlanType | string): PlanConfiguration {
  const config = PLAN_CONFIGS[planType as PlanType];
  if (!config) {
    throw new Error(`Invalid plan type: ${planType}`);
  }
  return config;
}

/**
 * Get all available plan types
 *
 * @returns Array of plan types
 */
export function getAllPlanTypes(): PlanType[] {
  return Object.values(PlanType);
}

/**
 * Get plan label for display
 *
 * @param planType - The plan type
 * @returns Display label
 */
export function getPlanLabel(planType: PlanType | string): string {
  return getPlanConfig(planType).label;
}

/**
 * Check if a plan type is valid
 *
 * @param planType - The plan type to validate
 * @returns True if valid
 */
export function isValidPlanType(planType: string): planType is PlanType {
  return Object.values(PlanType).includes(planType as PlanType);
}

/**
 * Convert database plan type to PlanType enum
 *
 * @param dbPlanType - Plan type from database
 * @returns PlanType enum value
 * @throws Error if invalid
 */
export function fromDatabasePlanType(dbPlanType: string): PlanType {
  if (!isValidPlanType(dbPlanType)) {
    throw new Error(`Invalid database plan type: ${dbPlanType}`);
  }
  return dbPlanType as PlanType;
}
