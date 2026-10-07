import { z } from 'zod'

/**
 * The Resend webhook events the mailing feature acts on (`/api/webhooks/resend`).
 * Field names are Resend's own (snake_case, `bounce.subType`). Anything else
 * the webhook is sent is acknowledged and ignored, so only these are parsed.
 */

const sentEmail = z.object({
  email_id: z.string().min(1),
  from: z.string(),
  to: z.array(z.string()).min(1),
})

export const resendWebhookEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('email.bounced'),
    data: sentEmail.extend({
      bounce: z.object({
        /** `Permanent`, `Transient` or `Undetermined`. */
        type: z.string(),
        subType: z.string().optional(),
        message: z.string().optional(),
      }),
    }),
  }),
  z.object({ type: z.literal('email.complained'), data: sentEmail }),
  z.object({
    type: z.literal('email.suppressed'),
    data: sentEmail.extend({
      suppressed: z.object({
        /** Always `Suppressed` (measured 2026-10-07); the cause is `reason`. */
        type: z.string(),
        /** e.g. `previous_bounce`, `previous_complaint`. */
        reason: z.string().optional(),
        message: z.string().optional(),
      }),
    }),
  }),
  z.object({
    type: z.literal('email.received'),
    data: z.object({
      email_id: z.string().min(1),
      from: z.string(),
      to: z.array(z.string()),
      cc: z.array(z.string()).nullish(),
      received_for: z.array(z.string()).nullish(),
      subject: z.string().nullish(),
    }),
  }),
  z.object({
    type: z.literal('contact.topics.updated'),
    data: z.object({
      email: z.string().min(1),
      topics: z.array(
        z.object({
          id: z.string(),
          subscription: z.enum(['opt_in', 'opt_out']),
        })
      ),
    }),
  }),
])

export type ResendWebhookEvent = z.infer<typeof resendWebhookEventSchema>

/** The event types the webhook is subscribed to, and the only ones it parses. */
export const HANDLED_RESEND_EVENTS = [
  'email.bounced',
  'email.complained',
  'email.suppressed',
  'email.received',
  'contact.topics.updated',
] as const satisfies readonly ResendWebhookEvent['type'][]
