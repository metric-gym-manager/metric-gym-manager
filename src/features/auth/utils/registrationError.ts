/**
 * Plain-language text for a failed Supabase sign-up (rule 2.8).
 *
 * Supabase's own messages ("Error sending confirmation email", "Database error
 * saving new user") describe our infrastructure, not anything the visitor can
 * act on, so they stay in the server log. A visitor gets either something
 * they can fix (a different password, a valid address) or a wait-and-retry
 * message with a support route.
 *
 * @module registrationError
 */

/**
 * The support address offered when sign-up fails for a reason the visitor
 * cannot fix. Equal to `CONTACT.supportEmail` in `features/marketing` (pinned
 * by `registrationError.test.ts`); written out here so the auth service does
 * not import the marketing barrel and its page components.
 */
export const REGISTRATION_SUPPORT_EMAIL = 'support@metricgymos.com'

export const EMAIL_ALREADY_REGISTERED = 'Email already registered'

/** The parts of a Supabase `AuthError` this mapping reads. */
export interface SignUpErrorLike {
  code?: string
  message?: string
}

const BY_CODE: Record<string, string> = {
  user_already_exists: EMAIL_ALREADY_REGISTERED,
  email_exists: EMAIL_ALREADY_REGISTERED,
  weak_password:
    'That password is too easy to guess. Please choose a different one.',
  over_email_send_rate_limit:
    'Too many sign-up attempts. Please wait a few minutes and try again.',
  over_request_rate_limit:
    'Too many sign-up attempts. Please wait a few minutes and try again.',
  email_address_invalid: 'Enter a valid email address.',
}

const GENERIC = `We couldn't create your account right now. Please try again in a few minutes. If it keeps happening, email ${REGISTRATION_SUPPORT_EMAIL}.`

/**
 * Map a Supabase sign-up error to the message shown on /register.
 *
 * @param error - The `error` from `supabase.auth.signUp`, or nothing when the
 *   call returned no user without an error.
 * @returns A message safe to show a visitor; never Supabase's own text.
 *
 * @example
 * describeRegistrationError({ code: 'unexpected_failure', message: 'Error sending confirmation email' })
 * // => "We couldn't create your account right now. … email support@metricgymos.com."
 */
export function describeRegistrationError(
  error: SignUpErrorLike | null | undefined
): string {
  if (error?.code && BY_CODE[error.code]) return BY_CODE[error.code]
  // Older auth servers sent this message without a code.
  if (error?.message?.includes('already registered')) {
    return EMAIL_ALREADY_REGISTERED
  }
  return GENERIC
}
