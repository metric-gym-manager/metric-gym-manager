/**
 * Access Control — public API.
 *
 * Biometric door/turnstile integration, gated on the Enterprise
 * `accessControlHardware` capability from the `PlanRestrictions` matrix.
 *
 * The design principle, in one line: **the terminal is the authority, not us.**
 * We push each member's paid-through window and the device enforces entry from
 * its own clock, so expiry keeps working when our servers or the gym's internet
 * are down — and our downtime can never lock a gym out of its own building.
 *
 * See `docs/architecture/access-control-integration.md`.
 */

// Domain — the sole authority on access policy
export {
  resolveAccessDecision,
  describeAccessDenial,
  type AccessDecision,
  type AccessDecisionInput,
} from './domain/AccessDecision'

export {
  deriveAccessCommands,
  containsValidPeriod,
  type AccessCommand,
  type SubjectSyncState,
} from './domain/AccessCommands'

// Config — owned here, imported by everyone else (R5)
export {
  AccessDenialReason,
  AccessIntent,
  AccessSyncStatus,
  VerifyType,
  CheckingStatus,
  MAX_SUBJECT_ID,
  GYM_TIMEZONE,
  SYNC_RETRY_BACKOFF_SECONDS,
  SYNC_MAX_ATTEMPTS,
  VENDOR_MAX_REQUESTS_PER_SECOND,
  DEVICE_CLOCK_SKEW_ALERT_SECONDS,
} from './config/AccessControlConfig'

// Date helpers — gym-local calendar days and device formatting
export {
  getGymToday,
  toGymDate,
  toCalendarDay,
  formatDeviceDate,
  addDays,
} from './utils/getGymToday'

// Services
export { SyncMemberAccess } from './services/SyncMemberAccess'
export type {
  SyncMemberAccessInput,
  SyncMemberAccessResult,
} from './services/SyncMemberAccess'
export type {
  IAccessControlRepository,
  MemberAccessContext,
  SyncStateUpdate,
  IncomingAccessEvent,
} from './services/IAccessControlRepository'
export { createAccessControlProvider } from './services/factory'

// Schemas
export {
  accessControlAccountSchema,
  registerDeviceSchema,
  updateDeviceSchema,
  enrolBiometricSchema,
  accessWebhookEventSchema,
  accessWebhookPayloadSchema,
  accessEventsQuerySchema,
  subjectIdSchema,
} from './schemas/access-control.schemas'

// Types
export type {
  AccessControlAccount,
  AccessDevice,
  MemberAccessSubject,
  AccessSyncJob,
  AccessEvent,
  AccessControlCredentials,
  MemberAccessStatus,
} from './types'
