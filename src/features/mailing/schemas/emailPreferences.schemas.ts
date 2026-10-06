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

/**
 * POST /api/public/email-preferences/one-click — a mail app's own
 * "Unsubscribe" button (RFC 8058). Everything arrives in the header's URL;
 * the body is only `List-Unsubscribe=One-Click`.
 */
export const oneClickUnsubscribeSchema = z.object({
  email: emailPreferencesSchema.shape.email,
  token: emailPreferencesSchema.shape.token,
  topic: z.nativeEnum(MailingTopic),
})

export type OneClickUnsubscribeInput = z.infer<typeof oneClickUnsubscribeSchema>
