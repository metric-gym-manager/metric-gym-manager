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
