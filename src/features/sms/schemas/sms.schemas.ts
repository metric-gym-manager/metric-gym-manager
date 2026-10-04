import { z } from 'zod'
import {
  MANUAL_SMS_TYPES,
  SMS_TYPES,
  SmsDeliveryStatus,
  type ManualSmsType,
  type SmsType,
} from '../config/SmsConfig'

// ============================================================
// SMS ENUMS
// ============================================================

// Rule 2.2: validate domain enums with the owning definition, never a second
// hand-listed `z.enum()` set. The list here was missing `welcome` and
// `reactivation` entirely — two of the seven kinds the database accepts and the
// application actually sends (204 and 33 rows respectively in production).
export const SMSType = z.enum(SMS_TYPES as [SmsType, ...SmsType[]])
export type SMSType = z.infer<typeof SMSType>

export const DeliveryStatus = z.nativeEnum(SmsDeliveryStatus)
export type DeliveryStatus = z.infer<typeof DeliveryStatus>

// ============================================================
// SEND SMS SCHEMA
// ============================================================

// Only the kinds the manual send can word from a member id (see
// MANUAL_SMS_TYPES): no receipt, no announcement.
export const ManualSMSType = z.enum(
  MANUAL_SMS_TYPES as unknown as [ManualSmsType, ...ManualSmsType[]]
)

export const sendSMSSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
  smsType: ManualSMSType,
  customMessage: z
    .string()
    .max(160, 'SMS message must not exceed 160 characters')
    .optional(),
})

export type SendSMSInput = z.infer<typeof sendSMSSchema>

// ============================================================
// REMINDER FILTERS SCHEMA
// ============================================================

export const reminderFiltersSchema = z.object({
  filter: z.enum(['all', 'upcoming', 'due_today', 'overdue']).optional(),
  sortBy: z.enum(['due_date_asc', 'last_reminder_desc']).optional(),
})

export type ReminderFiltersInput = z.infer<typeof reminderFiltersSchema>

// ============================================================
// MEMBER SMS HISTORY QUERY
// ============================================================

/**
 * Query params for `GET /api/members/[id]/sms-history`.
 *
 * Coerced because they arrive as strings from the URL. Capped rather than
 * unbounded: the endpoint it replaces fetched every row a member had ever
 * received and called the array length the total.
 */
export const smsHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
})

export type SmsHistoryQueryInput = z.infer<typeof smsHistoryQuerySchema>
