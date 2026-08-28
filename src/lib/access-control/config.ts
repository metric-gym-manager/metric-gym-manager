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
 * Shortest value we will accept as the webhook path token.
 *
 * `.env.example` specifies `openssl rand -hex 32`, which is 64 characters. The
 * floor is half that: comfortably below anything a generator produces, and
 * comfortably above anything a person types by hand.
 */
export const MIN_WEBHOOK_TOKEN_LENGTH = 32

/**
 * Fragments that mean a value was copied from documentation, not generated.
 *
 * Matched case-insensitively as substrings. None of these can occur inside a
 * hex token — they all need letters beyond `f` — and the odds of one appearing
 * in a random base64 secret are negligible, so this cannot reject a real
 * credential in practice.
 */
const PLACEHOLDER_MARKERS = [
  'your-',
  'your_',
  'changeme',
  'change-me',
  'change_me',
  'placeholder',
  'example',
  'replace',
  'xxxx',
  'todo',
] as const

/**
 * Why the configured webhook token is unusable, or `null` if it is fine.
 *
 * ## Why a placeholder has to be refused rather than accepted
 *
 * `.env.example` ships `ACCESS_CONTROL_WEBHOOK_TOKEN=your-hex-64-webhook-token`
 * so the variable is documented. Copy that file to `.env.local`, forget that
 * line, and you get an endpoint that authenticates successfully against a value
 * committed to the repository — while every probe returns exactly the `200` a
 * correctly configured deployment returns. There is no symptom. The only way
 * to find it is to read the value and recognise it, which is precisely the
 * thing nobody does.
 *
 * So the check is here rather than in a deploy script or a runbook: it is the
 * one place that cannot be skipped, and refusing costs a gym nothing. The
 * terminal enforces access from its own clock, so a refused webhook loses
 * attendance records — it never locks anyone out of a building.
 *
 * The reason is returned rather than logged here so the caller owns the log
 * line, and so this stays a pure function the tests can drive directly.
 *
 * @param raw - The raw environment value, or `undefined` when unset.
 * @returns A log-ready sentence, or `null` when the value is usable.
 */
export function describeWebhookTokenProblem(
  raw: string | undefined
): string | null {
  if (raw === undefined) {
    return 'ACCESS_CONTROL_WEBHOOK_TOKEN is not set — rejecting all device events'
  }

  const value = raw.trim()

  if (value.length === 0) {
    return 'ACCESS_CONTROL_WEBHOOK_TOKEN is set but empty — rejecting all device events'
  }

  // Checked before length, because a placeholder that happens to be long
  // enough should still say *why* it was refused.
  const marker = PLACEHOLDER_MARKERS.find((m) =>
    value.toLowerCase().includes(m)
  )

  if (marker) {
    return `ACCESS_CONTROL_WEBHOOK_TOKEN still contains placeholder text ("${marker}") — it was copied from .env.example rather than generated. Run: openssl rand -hex 32`
  }

  if (value.length < MIN_WEBHOOK_TOKEN_LENGTH) {
    return `ACCESS_CONTROL_WEBHOOK_TOKEN is ${value.length} characters; at least ${MIN_WEBHOOK_TOKEN_LENGTH} are required for the only credential on this endpoint. Run: openssl rand -hex 32`
  }

  return null
}

/**
 * The unguessable token in the inbound webhook's URL path.
 *
 * The vendor protocol defines no signature scheme, so this is the **primary**
 * (and, unless an IP allowlist is added, the only) credential on that
 * endpoint. `null` means the endpoint refuses everything: accepting anonymous
 * writes would be worse than dropping events.
 *
 * `null` covers unset **and** configured-but-unusable — see
 * `describeWebhookTokenProblem` for what the second one means and why it is
 * treated the same way.
 *
 * Whitespace is trimmed. A token pasted into a hosting dashboard with a
 * trailing newline would otherwise mismatch on every request, producing the
 * same silent, indistinguishable `401` as a wrong value.
 *
 * One platform-wide value rather than one per gym, because the vendor callback
 * was believed to be account level. VFT has since confirmed a callback URL per
 * gym is possible, which would allow a per-gym token — see §7 of
 * `docs/integrations/vft/vft-api-reference.md`.
 */
export function getWebhookPathToken(): string | null {
  const raw = process.env.ACCESS_CONTROL_WEBHOOK_TOKEN

  if (describeWebhookTokenProblem(raw) !== null) return null

  return raw!.trim()
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
