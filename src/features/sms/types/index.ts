// ============================================================
// SMS TYPES
// ============================================================

import type { SmsType } from '../config/SmsConfig'
import { SmsDeliveryStatus } from '../config/SmsConfig'

/** Re-exported from the domain authority (R5). Do not redeclare these. */
export type SMSType = SmsType
export type DeliveryStatus = `${SmsDeliveryStatus}`

/**
 * A row of `sms_logs`, exactly as the table defines it.
 *
 * `created_at` used to be declared here and **does not exist on the table**. The
 * member-history read selected it, so `GET /api/members/[id]/sms-history`
 * answered `42703: column "created_at" does not exist` and returned 500 on every
 * call. `sent_at` is the only timestamp this table has.
 *
 * `error_message` is on the row but is technical detail: it must never reach a
 * gym manager (rule 2.8), which is why the member-history read projects a
 * narrower shape rather than returning this type.
 */
export interface SMSLog {
  id: string
  member_id: string
  gym_id: string
  sms_type: SMSType
  phone_number: string
  message_body: string
  sent_at: string
  delivery_status: DeliveryStatus
  text_lk_message_id: string | null
  error_message: string | null
}

export interface MemberReminderStatus {
  id: string
  name: string
  phone_number: string
  plan_type: 'monthly' | 'daily' | 'annual' | '3-months' | '6-months'
  next_due_date: string
  days_until_due: number // Negative for overdue
  last_reminder_sent: string | null
  last_reminder_type: SMSType | null
  last_delivery_status: DeliveryStatus | null
  // Timestamp tracking for each reminder type
  reminder_7day_sent: string | null // Timestamp when 7-day reminder was sent
  reminder_3day_sent: string | null // Timestamp when 3-day reminder was sent
  due_today_sent: string | null // Timestamp when due-today reminder was sent
  overdue_sent: string | null // Timestamp when overdue reminder was sent (most recent)
  // Error tracking for each reminder type
  reminder_7day_error: boolean // True if 7-day reminder delivery failed
  reminder_3day_error: boolean // True if 3-day reminder delivery failed
  due_today_error: boolean // True if due-today reminder delivery failed
}

// ============================================================
// REQUEST/RESPONSE TYPES
// ============================================================

export interface SendSMSRequest {
  memberId: string
  smsType: SMSType
  customMessage?: string
}

export interface SendSMSResponse {
  success: boolean
  smsLog: SMSLog
}

export interface ReminderStatusResponse {
  reminders: MemberReminderStatus[]
  totalCount: number
}
