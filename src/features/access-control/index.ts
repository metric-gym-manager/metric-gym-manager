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

export {
  selectEvictionCandidates,
  slotsToReclaim,
  type EvictableSubject,
  type EvictionSelection,
} from './domain/EvictionPolicy'

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
  ACCESS_EVENT_RETENTION_DAYS,
} from './config/AccessControlConfig'

export {
  DeviceEventKind,
  classifyDeviceEvent,
  describeDeviceEvent,
  isUrgentEvent,
  toDenialReason,
} from './config/DeviceEventCodes'

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
  SyncFailure,
} from './services/SyncMemberAccess'
export { DrainAccessSyncQueue } from './services/DrainAccessSyncQueue'
export type { DrainAccessSyncQueueSummary } from './services/DrainAccessSyncQueue'
export { ReconcileMemberAccess } from './services/ReconcileMemberAccess'
export type { ReconcileMemberAccessSummary } from './services/ReconcileMemberAccess'
export { RecordAccessEvents } from './services/RecordAccessEvents'
export type { RecordAccessEventsSummary } from './services/RecordAccessEvents'
export { EvictInactiveSubjects } from './services/EvictInactiveSubjects'
export type { EvictInactiveSubjectsSummary } from './services/EvictInactiveSubjects'
export { OperateDevice } from './services/OperateDevice'
export type { OperateDeviceResult } from './services/OperateDevice'
export { VerifyAccessAccount } from './services/VerifyAccessAccount'
export { ManageMemberBiometric } from './services/ManageMemberBiometric'
export type { BiometricOperationResult } from './services/ManageMemberBiometric'
export { GetMemberAccessStatus } from './services/GetMemberAccessStatus'
export { RefreshDeviceStatus } from './services/RefreshDeviceStatus'
export type { RefreshDeviceStatusSummary } from './services/RefreshDeviceStatus'
export { DetectBiometricEnrolment } from './services/DetectBiometricEnrolment'
export { PushRename } from './services/PushRename'
export { PurgeExpiredAccessEvents } from './services/PurgeExpiredAccessEvents'
export type { PurgeExpiredAccessEventsSummary } from './services/PurgeExpiredAccessEvents'
export type { PushRenameResult } from './services/PushRename'
export { provisionMemberAccessBestEffort } from './services/provisionMemberAccessBestEffort'
export type { DetectBiometricEnrolmentResult } from './services/DetectBiometricEnrolment'
export type {
  IAccessControlRepository,
  MemberAccessContext,
  SyncStateUpdate,
  IncomingAccessEvent,
  EvictionCandidate,
} from './services/IAccessControlRepository'
export {
  createAccessControlProvider,
  createAccessControlRepository,
  createSyncMemberAccess,
  createDrainAccessSyncQueue,
  createReconcileMemberAccess,
  createRecordAccessEvents,
  createEvictInactiveSubjects,
  createOperateDevice,
  createRegisterDevice,
  createVerifyAccessAccount,
  createManageMemberBiometric,
  createGetMemberAccessStatus,
  createRefreshDeviceStatus,
  createDetectBiometricEnrolment,
  createPushRename,
  createPurgeExpiredAccessEvents,
} from './services/factory'

// Serializers — no database row is handed to JSON directly (rule 2.11)
export {
  serializeAccessAccountForAPI,
  serializeAccessDeviceForAPI,
  serializeAccessEventForAPI,
} from './utils/serializeAccessForAPI'
export type {
  SerializedAccessAccount,
  SerializedAccessDevice,
  SerializedAccessEvent,
} from './utils/serializeAccessForAPI'
export { SupabaseAccessControlRepository } from './services/SupabaseAccessControlRepository'

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
  MemberAccessStatus,
} from './types'
