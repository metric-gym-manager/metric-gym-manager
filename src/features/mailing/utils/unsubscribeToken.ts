import { createHmac, timingSafeEqual } from 'node:crypto'

/** A secret shorter than this is a configuration mistake, not a key. */
const MIN_SECRET_LENGTH = 32

/**
 * The form every mailing email is compared and signed in: trimmed and
 * lowercased, with a space turned back into `+`.
 *
 * Broadcast links carry `{{{contact.email}}}` unencoded, so a query string
 * decodes `owner+gym@titan.lk` to `owner gym@titan.lk`. An address cannot
 * contain a space, so any space there was a plus.
 *
 * @param email - The address as it arrived
 * @returns The normalized address
 */
export function normalizeMailingEmail(email: string): string {
  return email.trim().replace(/ /g, '+').toLowerCase()
}

/**
 * Sign an email address for an unsubscribe link.
 *
 * The token is stored on the Resend contact (`unsubscribe_token`) and placed
 * in each broadcast's footer link, so only someone holding that email can
 * change that contact's preferences.
 *
 * @param email - The contact's address (normalized here)
 * @param secret - `MARKETING_UNSUBSCRIBE_SECRET`
 * @returns A URL-safe HMAC-SHA256 token
 * @throws When the secret is shorter than 32 characters
 *
 * @example
 * createUnsubscribeToken('owner@titanfitness.lk', process.env.MARKETING_UNSUBSCRIBE_SECRET!)
 */
export function createUnsubscribeToken(email: string, secret: string): string {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error('MARKETING_UNSUBSCRIBE_SECRET is too short')
  }
  return createHmac('sha256', secret)
    .update(normalizeMailingEmail(email))
    .digest('base64url')
}

/**
 * Check an unsubscribe link's token in constant time.
 *
 * @param email - The address from the link
 * @param token - The token from the link
 * @param secret - `MARKETING_UNSUBSCRIBE_SECRET`
 * @returns True only when the token was made for this email with this secret
 */
export function verifyUnsubscribeToken(
  email: string,
  token: string,
  secret: string
): boolean {
  if (secret.length < MIN_SECRET_LENGTH) return false
  const expected = Buffer.from(createUnsubscribeToken(email, secret))
  const given = Buffer.from(token)
  return given.length === expected.length && timingSafeEqual(given, expected)
}
