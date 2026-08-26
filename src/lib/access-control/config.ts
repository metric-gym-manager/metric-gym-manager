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
 * The unguessable token in the inbound webhook's URL path.
 *
 * The vendor protocol defines no signature scheme, so this is the **primary**
 * (and, unless an IP allowlist is added, the only) credential on that
 * endpoint. `null` means the endpoint refuses everything: accepting anonymous
 * writes would be worse than dropping events.
 *
 * One platform-wide value rather than one per gym, because the vendor callback
 * is configured at account level — there is no per-gym URL to hand out. The
 * gym is resolved from the device serial instead.
 */
export function getWebhookPathToken(): string | null {
  return process.env.ACCESS_CONTROL_WEBHOOK_TOKEN ?? null
}

/**
 * Shared secret expected on inbound webhook calls, when configured.
 *
 * An optional second factor alongside the path token, for a deployment that
 * can arrange one.
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
