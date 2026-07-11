export {
  APP_VERSION,
  APP_MAJOR_VERSION,
  APP_VERSION_STORAGE_KEY,
  CURRENT_SW_CACHE_NAME,
} from './app-version';
export {
  safeJsonParse,
  safeGetItem,
  safeSetItem,
  safeRemoveItem,
  safeListKeys,
  safeReadJson,
  safeWriteJson,
  namespacedKey,
  appStorage,
  type ParseResult,
} from './safe-storage';
export {
  isSupabaseAuthCookie,
  isSupabaseSessionCookie,
  isWellFormedSessionValue,
  findCorruptSessionCookieNames,
  isInvalidRefreshTokenError,
  isRetryableAuthError,
  type CookiePair,
} from './auth-token-guard';
export {
  readBrowserCookies,
  expireBrowserCookie,
  purgeSupabaseAuthCookies,
  purgeSupabaseLocalStorage,
  validateAndRepairAuthState,
  hardResetAuthState,
  consumeAuthFailedFlag,
} from './browser-auth-recovery';
export { enforceClientStateVersion, type VersionGuardResult } from './version-guard';
