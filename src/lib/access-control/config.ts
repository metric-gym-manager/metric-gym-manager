/**
 * Access-control provider configuration.
 *
 * Environment reads live here so the provider itself stays testable and the
 * feature never touches `process.env` directly.
 */

/** Whether real hardware calls are enabled. Off unless explicitly turned on. */
export function isAccessControlEnabled(): boolean {
  return process.env.ACCESS_CONTROL_ENABLED === 'true'
}

/**
 * Default vendor base URL.
 *
 * Per-gym accounts store their own, so this is only a fallback for
 * single-deployment setups.
 */
export function getDefaultBaseUrl(): string | null {
  return process.env.VFT_API_BASE_URL ?? null
}

/**
 * Shared secret expected on inbound webhook calls, when configured.
 *
 * The vendor protocol defines no signature scheme, so the primary defence is an
 * unguessable token in the URL path. This is an optional second factor.
 */
export function getWebhookSecret(): string | null {
  return process.env.ACCESS_CONTROL_WEBHOOK_SECRET ?? null
}

/** Per-request timeout against the vendor API, in milliseconds. */
export const VENDOR_REQUEST_TIMEOUT_MS = 15_000

/**
 * How long a cached bearer token is treated as usable.
 *
 * The vendor documents no lifetime, so this is a conservative ceiling: a token
 * is refreshed well before any plausible expiry, and a 401 refreshes it
 * immediately regardless.
 */
export const TOKEN_CACHE_TTL_SECONDS = 30 * 60
