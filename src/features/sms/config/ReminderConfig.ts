/**
 * Reminder Configuration - Single Source of Truth
 *
 * This file defines when reminders should be sent for each plan type.
 *
 * Extracted from:
 * - src/features/sms/services/reminder.service.ts (lines 236-273)
 * - src/components/payment-collection/PaymentRemindersTable.tsx (lines 116-118)
 *
 * CRITICAL: This is the ONLY place where reminder rules should be defined.
 */

import { PlanType } from '@/features/members/config/PlanConfig'

/**
 * SMS reminder types
 */
export enum ReminderType {
  SevenDay = 'reminder_7day',
  ThreeDay = 'reminder_3day',
  DueToday = 'due_today',
  Overdue = 'overdue',
}

/**
 * Reminder rule configuration for a plan type
 */
export interface ReminderRule {
  /**
   * Days before due date when reminders should be sent
   * Positive: days before due
   * Zero: due today
   * Negative: days overdue
   *
   * Example: [7, 3, 0] means send at 7 days before, 3 days before, and on due date
   */
  readonly reminderDays: readonly number[]

  /**
   * Enabled reminder types for this plan
   */
  readonly enabledReminders: readonly ReminderType[]
}

/**
 * SINGLE SOURCE OF TRUTH for reminder rules
 *
 * ⚠️ CRITICAL Business Rules:
 * - Daily members: NO automatic reminders (too frequent)
 * - Monthly members: SKIP 7-day reminder (only 3-day and due-day)
 * - Weekly, 3-months, 6-months, Annual: All reminders (7-day, 3-day, due-day)
 * - Overdue reminders: Sent for ALL plan types when payment is late
 *
 * DO NOT hardcode these rules elsewhere!
 */
export const REMINDER_RULES: Readonly<Record<PlanType, ReminderRule>> = {
  [PlanType.Daily]: {
    reminderDays: [],
    enabledReminders: [],
    // NO automatic reminders for daily members (too frequent)
  },

  [PlanType.Weekly]: {
    reminderDays: [7, 3, 0],
    enabledReminders: [
      ReminderType.SevenDay,
      ReminderType.ThreeDay,
      ReminderType.DueToday,
      ReminderType.Overdue,
    ],
  },

  [PlanType.Monthly]: {
    reminderDays: [3, 0], // SKIP 7-day reminder
    enabledReminders: [
      ReminderType.ThreeDay,
      ReminderType.DueToday,
      ReminderType.Overdue,
    ],
    // Monthly members don't get 7-day reminders (plan is only 30 days)
  },

  [PlanType.ThreeMonths]: {
    reminderDays: [7, 3, 0],
    enabledReminders: [
      ReminderType.SevenDay,
      ReminderType.ThreeDay,
      ReminderType.DueToday,
      ReminderType.Overdue,
    ],
  },

  [PlanType.SixMonths]: {
    reminderDays: [7, 3, 0],
    enabledReminders: [
      ReminderType.SevenDay,
      ReminderType.ThreeDay,
      ReminderType.DueToday,
      ReminderType.Overdue,
    ],
  },

  [PlanType.Annual]: {
    reminderDays: [7, 3, 0],
    enabledReminders: [
      ReminderType.SevenDay,
      ReminderType.ThreeDay,
      ReminderType.DueToday,
      ReminderType.Overdue,
    ],
  },

  [PlanType.Custom]: {
    reminderDays: [7, 3, 0],
    enabledReminders: [
      ReminderType.SevenDay,
      ReminderType.ThreeDay,
      ReminderType.DueToday,
      ReminderType.Overdue,
    ],
    // Custom plans get all reminders by default
  },
} as const

/**
 * Get reminder rule for a plan type
 *
 * @param planType - The plan type
 * @returns Reminder rule configuration
 * @throws Error if plan type is invalid
 */
export function getReminderRule(planType: PlanType | string): ReminderRule {
  const rule = REMINDER_RULES[planType as PlanType]
  if (!rule) {
    throw new Error(`Invalid plan type for reminder rules: ${planType}`)
  }
  return rule
}

/**
 * Check if a reminder should be sent for a plan type at a specific number of days
 *
 * This is the CENTRAL function used by the reminder cron job.
 *
 * @param planType - The plan type
 * @param daysUntilDue - Number of days until due date (negative if overdue)
 * @returns True if a reminder should be sent
 *
 * @example
 * shouldSendReminder(PlanType.Monthly, 7) // false (monthly skips 7-day)
 * shouldSendReminder(PlanType.Monthly, 3) // true
 * shouldSendReminder(PlanType.Weekly, 7) // true
 * shouldSendReminder(PlanType.Daily, 3) // false (daily gets no reminders)
 */
export function shouldSendReminder(
  planType: PlanType | string,
  daysUntilDue: number
): boolean {
  const rule = getReminderRule(planType)

  // Special case: Overdue reminders (negative days)
  if (daysUntilDue < 0) {
    return rule.enabledReminders.includes(ReminderType.Overdue)
  }

  // Use range-based checks for idempotency (handles cron timing issues)
  // Check if daysUntilDue falls within any of the configured reminder ranges
  for (const reminderDay of rule.reminderDays) {
    if (daysUntilDue >= reminderDay && daysUntilDue < reminderDay + 1) {
      return true
    }
  }

  return false
}

/**
 * Get the reminder type for a specific number of days until due
 *
 * @param daysUntilDue - Number of days until due date
 * @returns Reminder type, or null if no reminder
 *
 * @example
 * getReminderType(7) // ReminderType.SevenDay
 * getReminderType(3) // ReminderType.ThreeDay
 * getReminderType(0) // ReminderType.DueToday
 * getReminderType(-5) // ReminderType.Overdue
 * getReminderType(5) // null (no reminder)
 */
export function getReminderType(daysUntilDue: number): ReminderType | null {
  if (daysUntilDue >= 7 && daysUntilDue < 8) {
    return ReminderType.SevenDay
  } else if (daysUntilDue >= 3 && daysUntilDue < 4) {
    return ReminderType.ThreeDay
  } else if (daysUntilDue >= 0 && daysUntilDue < 1) {
    return ReminderType.DueToday
  } else if (daysUntilDue < 0) {
    return ReminderType.Overdue
  }
  return null
}

/**
 * Get all enabled reminder types for a plan
 *
 * @param planType - The plan type
 * @returns Array of enabled reminder types
 */
export function getEnabledReminders(
  planType: PlanType | string
): readonly ReminderType[] {
  return getReminderRule(planType).enabledReminders
}

/**
 * Get all reminder days for a plan
 *
 * @param planType - The plan type
 * @returns Array of days when reminders should be sent
 */
export function getReminderDays(
  planType: PlanType | string
): readonly number[] {
  return getReminderRule(planType).reminderDays
}

/**
 * Check if a plan has any automatic reminders enabled
 *
 * @param planType - The plan type
 * @returns True if plan has reminders
 */
export function hasReminders(planType: PlanType | string): boolean {
  return getReminderRule(planType).reminderDays.length > 0
}

/**
 * Get reminder type display label
 *
 * @param reminderType - The reminder type
 * @returns Display label
 */
export function getReminderTypeLabel(reminderType: ReminderType): string {
  switch (reminderType) {
    case ReminderType.SevenDay:
      return '7-Day Reminder'
    case ReminderType.ThreeDay:
      return '3-Day Reminder'
    case ReminderType.DueToday:
      return 'Due Today'
    case ReminderType.Overdue:
      return 'Overdue Reminder'
    default:
      return reminderType
  }
}
