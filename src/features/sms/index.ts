// ============================================================
// SMS FEATURE EXPORTS
// ============================================================

// NOTE: Old service-layer exports have been deprecated in favor of Clean Architecture.
// Use cases and repositories should be accessed via the DI container.
// See: src/infrastructure/di/Container.ts

// Legacy exports (to be removed in future version)
// These are kept temporarily for backward compatibility with existing code
export {
  sendSMS,
  getReminderStatus,
  formatReceiptSMS,
} from './services/sms.service';

// Deprecated: Use SendAutomatedReminders use case via DI container
// export { sendAutomatedReminders } from './services/reminder.service';

// Deprecated: Use UpdateExpiredStatus use case via DI container
// export { updateExpiredMemberStatus } from './services/reminder.service';

// Deprecated: ArchiveOldMembers use case not yet implemented
// export { archiveOldMembers } from './services/reminder.service';

export {
  sendSmsViaTextLk,
  getSmsDeliveryStatus,
  getTextLkBalance,
} from './services/textlk.service';

// Export SMS types
export type {
  SMSType,
  DeliveryStatus,
  SMSLog,
  MemberReminderStatus,
  SendSMSRequest,
  SendSMSResponse,
  ReminderStatusResponse,
} from './types';

// Export SMS schemas
export {
  sendSMSSchema,
  reminderFiltersSchema,
} from './schemas/sms.schemas';

export type {
  SendSMSInput,
  ReminderFiltersInput,
} from './schemas/sms.schemas';
