/**
 * Access-control hardware glue.
 *
 * Third-party integration only (R8): no gym business rules live here. The
 * decision about *whether* a member may enter belongs to
 * `features/access-control/domain/AccessDecision.ts`; this layer only speaks to
 * the hardware.
 */

export type {
  AccessCredentials,
  AccessDeviceInfo,
  AccessSubjectInfo,
  CommandOutcome,
  IAccessControlProvider,
  PendingCommand,
  SubjectOnDevice,
  ValidPeriodInput,
} from './IAccessControlProvider'

export { MockAccessControlProvider } from './MockAccessControlProvider'
export type { RecordedCommand } from './MockAccessControlProvider'
export {
  VftAccessControlProvider,
  VendorAuthError,
  VendorRequestError,
} from './VftAccessControlProvider'

export {
  isAccessControlEnabled,
  getDefaultBaseUrl,
  getWebhookSecret,
  VENDOR_REQUEST_TIMEOUT_MS,
  TOKEN_CACHE_TTL_SECONDS,
} from './config'

export {
  encryptSecret,
  decryptSecret,
  generateWebhookToken,
  safeCompare,
} from './crypto'
