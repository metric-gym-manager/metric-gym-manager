import { z } from 'zod';

// ============================================================
// SMS ENUMS
// ============================================================

export const SMSType = z.enum([
  'reminder_7day',
  'reminder_3day',
  'due_today',
  'overdue',
  'receipt',
]);
export type SMSType = z.infer<typeof SMSType>;

export const DeliveryStatus = z.enum(['sent', 'delivered', 'failed']);
export type DeliveryStatus = z.infer<typeof DeliveryStatus>;

// ============================================================
// SEND SMS SCHEMA
// ============================================================

export const sendSMSSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
  smsType: SMSType,
  customMessage: z.string().max(160, 'SMS message must not exceed 160 characters').optional(),
});

export type SendSMSInput = z.infer<typeof sendSMSSchema>;

// ============================================================
// REMINDER FILTERS SCHEMA
// ============================================================

export const reminderFiltersSchema = z.object({
  filter: z.enum(['all', 'upcoming', 'due_today', 'overdue']).optional(),
  sortBy: z.enum(['due_date_asc', 'last_reminder_desc']).optional(),
});

export type ReminderFiltersInput = z.infer<typeof reminderFiltersSchema>;
