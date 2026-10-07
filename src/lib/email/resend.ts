import { Resend } from 'resend'

/** A secret shorter than this cannot sign unsubscribe links safely. */
const MIN_SECRET_LENGTH = 32

/**
 * The Resend client for marketing email (contacts, topics, segments).
 *
 * `RESEND_API_KEY` must be a FULL-ACCESS key: the contacts and topics
 * endpoints answer 401 `restricted_api_key` to a sending-only one. Unset means
 * no client, so callers report "not configured" instead of failing at import.
 * Server-only — never import this from a client component.
 *
 * @param env - Variables to read (defaults to `process.env`)
 * @returns A client, or `null` when `RESEND_API_KEY` is unset
 */
export function createResendClient(
  env: Record<string, string | undefined> = process.env
): Resend | null {
  const key = env.RESEND_API_KEY?.trim()
  return key ? new Resend(key) : null
}

/**
 * The secret that signs unsubscribe links (`MARKETING_UNSUBSCRIBE_SECRET`).
 *
 * @param env - Variables to read (defaults to `process.env`)
 * @returns The secret, or `null` when it is unset or shorter than 32 characters
 */
export function readMailingSecret(
  env: Record<string, string | undefined> = process.env
): string | null {
  const secret = env.MARKETING_UNSUBSCRIBE_SECRET?.trim()
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null
}

export type ResendWebhookVerification =
  | { ok: true; event: unknown }
  | { ok: false; reason: 'not_configured' | 'invalid_signature' }

/**
 * Check a Resend webhook delivery's signature (`RESEND_WEBHOOK_SECRET`, the
 * endpoint's `whsec_…` signing secret). Resend signs the Standard Webhooks
 * way: `svix-id`, `svix-timestamp`, `svix-signature` (the `webhook-*` names
 * are accepted too); the SDK checks the HMAC in constant time and refuses a
 * timestamp more than five minutes off, so an old delivery cannot be replayed.
 *
 * @param payload - The raw request body, exactly as received
 * @param headers - The request's headers
 * @param env - Variables to read (defaults to `process.env`)
 * @returns The parsed event, or why it was refused. Never throws.
 */
export function verifyResendWebhook(
  payload: string,
  headers: { get(name: string): string | null },
  env: Record<string, string | undefined> = process.env
): ResendWebhookVerification {
  const secret = env.RESEND_WEBHOOK_SECRET?.trim()
  const client = createResendClient(env)
  if (!secret || !client) return { ok: false, reason: 'not_configured' }
  const header = (name: string) =>
    headers.get(`svix-${name}`) ?? headers.get(`webhook-${name}`)
  const id = header('id')
  const timestamp = header('timestamp')
  const signature = header('signature')
  if (!id || !timestamp || !signature) {
    return { ok: false, reason: 'invalid_signature' }
  }
  try {
    const event: unknown = client.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret: secret,
    })
    return { ok: true, event }
  } catch {
    return { ok: false, reason: 'invalid_signature' }
  }
}
