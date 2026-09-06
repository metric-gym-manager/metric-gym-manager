/**
 * SMS Repository Interface (Port)
 *
 * Defines the contract for SMS log data access.
 * This stores records of all SMS messages sent by the system.
 */

import {
  SmsDeliveryStatus,
  type SmsType,
} from '@/features/sms/config/SmsConfig'

/**
 * SMS type and delivery status are owned by `config/SmsConfig.ts` (R5) and
 * re-exported here so the port keeps its existing surface — nine files across
 * payments, members and sms import `SMSDeliveryStatus` from this module.
 *
 * The previous local declaration listed `'cancellation' | 'manual' | 'other'`,
 * none of which exist in the `sms_type` Postgres enum and none of which had a
 * single usage in the repository. Writing one would have failed at runtime the
 * way `welcome` and `reactivation` did before their migrations.
 */
export type SMSType = SmsType

// An enum is both a value and a type, so both halves are aliased — call sites use
// `SMSDeliveryStatus.Sent` (value) and `: SMSDeliveryStatus` (type).
export const SMSDeliveryStatus = SmsDeliveryStatus
export type SMSDeliveryStatus = SmsDeliveryStatus

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
 * One row of a member's SMS history, as a gym manager may see it.
 *
 * A deliberately narrower shape than {@link SMSLog}: `errorMessage` is absent
 * because raw provider text is `/system-health` material, not gym-manager
 * material (rule 2.8). The omission is enforced in the SQL projection, so the
 * value never reaches this process.
 */
export interface MemberSmsHistoryEntry {
  id: string
  smsType: SMSType
  phoneNumber: string
  messageBody: string
  sentAt: Date
  deliveryStatus: SMSDeliveryStatus
  textLkMessageId: string | null
}

/** A page of {@link MemberSmsHistoryEntry}, with the true total behind it. */
export interface MemberSmsHistoryPage {
  entries: MemberSmsHistoryEntry[]
  /** Total matching rows in the database, not the length of this page. */
  totalCount: number
  page: number
  pageSize: number
  pageCount: number
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
   * A page of one member's SMS history, scoped to a gym.
   *
   * Distinct from {@link findByMemberId}, which selects every column of every row
   * for one member and scopes only by `member_id`. This one:
   *
   * - filters on `gym_id` **as well**, so tenant isolation is stated in the query
   *   rather than left entirely to RLS;
   * - projects the sanitised column set (no `error_message`, rule 2.8);
   * - is paginated, and returns the true total rather than the page length.
   *
   * @param gymId - Owning gym; rows outside it are never returned.
   * @param memberId - The member whose history is wanted.
   * @param options - 1-based page and page size.
   */
  findHistoryForMember(
    gymId: string,
    memberId: string,
    options?: { page?: number; pageSize?: number }
  ): Promise<MemberSmsHistoryPage>

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
   * Apply a delivery report to the row bearing a vendor message id.
   *
   * **Returns the number of rows it actually changed**, and that return value is
   * the point of the method. The previous signature was `Promise<void>`, so a
   * caller could not distinguish "updated" from "matched nothing" — and a
   * Supabase `.update()` without `.select()` reports no error when zero rows
   * match. With RLS denying the write (there is no UPDATE policy on `sms_logs`)
   * the webhook therefore logged success and returned 200 having changed
   * nothing, for every delivery report the vendor ever sent.
   *
   * Callers must pass a **service-role** client: writes to `sms_logs` are not
   * covered by any policy and a session client is silently refused (R7).
   *
   * @param messageId - Vendor message id, matched against `text_lk_message_id`.
   * @param status - The state the report puts the message in.
   * @returns How many rows were updated: 0 when the id is unknown, 1 normally.
   */
  updateDeliveryStatus(
    messageId: string,
    status: SMSDeliveryStatus
  ): Promise<number>

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
