// ============================================================
// SMS FEATURE EXPORTS (public API)
// ============================================================

// Factories (compose services for routes/cron; wiring mirrors the old DI container)
export {
  createSMSProvider,
  createSMSRepository,
  createSendAutomatedReminders,
} from './services/factory'

// Use case
export {
  SendAutomatedReminders,
  type SendAutomatedRemindersInput,
  type ReminderSummary,
} from './services/SendAutomatedReminders'

// Ports (interfaces) owned by this feature
export type {
  ISMSProvider,
  ISMSTemplate,
  SMSMessage,
  SMSSendResult,
} from './services/ISMSProvider'
export {
  type ISMSRepository,
  type SMSLog as SMSLogRecord,
  type CreateSMSLogProps,
  type SMSFilters,
  type SMSType as SMSLogType,
  SMSDeliveryStatus,
} from './services/ISMSRepository'

// Providers
export { TextLkSMSProvider, MockSMSProvider } from './services/providers'

// Reminder configuration (windows/types for automated reminders)
export {
  ReminderType,
  type ReminderRule,
  REMINDER_RULES,
  getReminderRule,
  shouldSendReminder,
  getReminderType,
  getEnabledReminders,
  getReminderDays,
  hasReminders,
  getReminderTypeLabel,
} from './config/ReminderConfig'

// Reminder-queue read model (upcoming automated reminders → dashboard panel)
export {
  getReminderQueue,
  computeReminderQueue,
  type ReminderQueueEntry,
  type ReminderQueueResult,
} from './services/reminder-queue.service'

// Browser/server API-client services
export {
  sendSMS,
  getReminderStatus,
  formatReceiptSMS,
} from './services/sms.service'

export { sendSmsViaTextLk, getTextLkBalance } from './services/textlk.service'

// Types
export type {
  SMSType,
  DeliveryStatus,
  SMSLog,
  MemberReminderStatus,
  SendSMSRequest,
  SendSMSResponse,
  ReminderStatusResponse,
} from './types'

// Schemas
export { sendSMSSchema, reminderFiltersSchema } from './schemas/sms.schemas'

export type { SendSMSInput, ReminderFiltersInput } from './schemas/sms.schemas'

/**
 * NOTE: this barrel is **server-tainted** — it re-exports `sms.service`, which
 * imports `@/lib/supabase/server` (and so `next/headers`). A client component
 * must deep-import `./components/MemberSmsHistory` instead; importing it from
 * here drags server-only modules into the browser bundle. Rule 2.15 records the
 * same hazard on the auth barrel.
 */
export { MemberSmsHistory } from './components/MemberSmsHistory'
export type { MemberSmsHistoryProps } from './components/MemberSmsHistory'
