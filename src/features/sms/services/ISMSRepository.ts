/**
 * SMS Repository Interface (Port)
 *
 * Defines the contract for SMS log data access.
 * This stores records of all SMS messages sent by the system.
 */

import { ReminderType } from '@/features/sms/config/ReminderConfig'

/**
 * SMS types
 */
export type SMSType =
  | ReminderType
  | 'receipt'
  | 'welcome'
  | 'reactivation'
  | 'cancellation'
  | 'manual'
  | 'other'

/**
 * SMS delivery status
 */
export enum SMSDeliveryStatus {
  Pending = 'pending',
  Sent = 'sent',
  Delivered = 'delivered',
  Failed = 'failed',
}

/**
 * SMS log entry
 */
export interface SMSLog {
  id: string
  memberId: string
  gymId: string
  smsType: SMSType
  phoneNumber: string
  messageBody: string
  sentAt: Date
  deliveryStatus: SMSDeliveryStatus
  textLkMessageId: string | null
  errorMessage: string | null
}

/**
 * Properties for creating a new SMS log
 */
export type CreateSMSLogProps = Omit<SMSLog, 'id'>

/**
 * SMS query filters
 */
export interface SMSFilters {
  /**
   * Gym ID (required for multi-tenancy)
   */
  gymId: string

  /**
   * Filter by member ID
   */
  memberId?: string

  /**
   * Filter by SMS type
   */
  smsType?: SMSType

  /**
   * Filter by delivery status
   */
  deliveryStatus?: SMSDeliveryStatus

  /**
   * Filter by date range (start)
   */
  startDate?: Date

  /**
   * Filter by date range (end)
   */
  endDate?: Date

  /**
   * Pagination: page number (1-indexed)
   */
  page?: number

  /**
   * Pagination: items per page
   */
  limit?: number
}

/**
 * SMS Repository Interface
 *
 * This defines all data access operations for SMS logs.
 * Used for tracking, duplicate prevention, and analytics.
 *
 * @example
 * // Check if reminder was already sent today
 * const alreadySent = await smsRepo.existsForToday(
 *   memberId,
 *   ReminderType.ThreeDay
 * );
 *
 * @example
 * // Log SMS after sending
 * await smsRepo.create({
 *   memberId,
 *   gymId,
 *   smsType: 'receipt',
 *   phoneNumber: '+94771234567',
 *   messageBody: 'Payment received!',
 *   sentAt: new Date(),
 *   deliveryStatus: SMSDeliveryStatus.Sent,
 *   textLkMessageId: 'msg-123',
 *   errorMessage: null
 * });
 */
export interface ISMSRepository {
  /**
   * Find SMS log by ID
   *
   * @param id - SMS log ID
   * @returns SMS log if found, null otherwise
   */
  findById(id: string): Promise<SMSLog | null>

  /**
   * Find all SMS logs for a member
   *
   * Used for displaying SMS history in member details.
   *
   * @param memberId - Member ID
   * @returns Array of SMS logs sorted by date (newest first)
   */
  findByMemberId(memberId: string): Promise<SMSLog[]>

  /**
   * Find all SMS logs with filters
   *
   * @param filters - Query filters
   * @returns Array of SMS logs
   */
  findAll(filters: SMSFilters): Promise<SMSLog[]>

  /**
   * Create a new SMS log entry
   *
   * @param log - SMS log data
   * @returns Created SMS log with assigned ID
   */
  create(log: CreateSMSLogProps): Promise<SMSLog>

  /**
   * Check if SMS was already sent today
   *
   * This is CRITICAL for preventing duplicate reminders.
   * Used by reminder cron job before sending each SMS.
   *
   * @param memberId - Member ID
   * @param smsType - Type of SMS
   * @returns True if SMS was already sent today
   */
  existsForToday(memberId: string, smsType: SMSType): Promise<boolean>

  /**
   * Get SMS count by type for a gym
   *
   * Used for analytics and monitoring.
   *
   * @param gymId - Gym ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Count by SMS type
   */
  countByType(
    gymId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Record<SMSType, number>>

  /**
   * Get failed SMS logs
   *
   * Used for monitoring and debugging SMS delivery issues.
   *
   * @param gymId - Gym ID
   * @param limit - Maximum number of logs to return
   * @returns Array of failed SMS logs
   */
  getFailedMessages(gymId: string, limit?: number): Promise<SMSLog[]>

  /**
   * Update delivery status
   *
   * Used for updating status based on webhook callbacks from SMS provider.
   *
   * @param messageId - Text.lk message ID
   * @param status - New delivery status
   */
  updateDeliveryStatus(
    messageId: string,
    status: SMSDeliveryStatus
  ): Promise<void>

  /**
   * Get SMS stats for dashboard
   *
   * @param gymId - Gym ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns SMS statistics
   */
  getStats(
    gymId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalSent: number
    totalDelivered: number
    totalFailed: number
    byType: Record<SMSType, number>
  }>
}
