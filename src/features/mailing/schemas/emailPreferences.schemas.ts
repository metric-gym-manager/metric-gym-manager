import { z } from 'zod'
import { MailingTopic } from '../config/MailingConfig'

/**
 * POST /api/public/email-preferences — the /unsubscribe page's request.
 *
 * Anonymous: the token is the credential (an HMAC of the email, checked in
 * `UpdateEmailPreferences`). Here only its shape is checked — base64url, the
 * alphabet `createUnsubscribeToken` produces. The email is not run through
 * `.email()` because a link can deliver `a b@x.lk` for `a+b@x.lk`; the
 * use-case normalizes it and the token decides whether it is genuine.
 */
export const emailPreferencesSchema = z.object({
  email: z.string().trim().min(3).max(254),
  token: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/, 'Invalid link'),
  topics: z
    .array(z.nativeEnum(MailingTopic))
    .min(1, 'Choose at least one kind of email')
    .transform((topics) => [...new Set(topics)]),
})

export type EmailPreferencesInput = z.infer<typeof emailPreferencesSchema>
