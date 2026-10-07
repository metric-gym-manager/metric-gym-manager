/**
 * Resend webhook — the outreach series' two owner tasks, automated (owner
 * request, 2026-10-06; docs/architecture/marketing-email.md, "Outreach").
 *
 * Subscribed in Resend to `email.bounced`, `email.complained`,
 * `email.suppressed`, `email.received` and `contact.topics.updated`:
 *
 * - a hard bounce, spam complaint or suppressed send of an outreach email
 *   ends that address's series, and may trip the safety brake;
 * - an email to unsubscribe@go.metricgymos.com (the List-Unsubscribe mailto,
 *   which some mail apps use) opts its sender out;
 * - a Marketing opt-out made anywhere ends the series at once;
 * - any other email received on the outreach domain is passed to the owner.
 *
 * ## Credential
 *
 * The signature (`RESEND_WEBHOOK_SECRET`, Standard Webhooks / Svix) is the
 * only credential, checked over the raw body before anything is parsed.
 * Unsigned, forged or replayed: 401.
 *
 * ## Response contract
 *
 * **Always 200 for business outcomes**, like the PayHere, text.lk and
 * access-control webhooks: an event type we do not act on, or a malformed
 * payload, will be no different on a retry. Non-2xx is reserved for "a retry
 * might work": 401 (bad signature), 500 (unconfigured, or a fault while
 * acting — Resend retries, and every step is safe to repeat).
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  HANDLED_RESEND_EVENTS,
  createHandleMailingEvent,
  resendWebhookEventSchema,
} from '@/features/mailing'
import { verifyResendWebhook } from '@/lib/email/resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { ResponseBuilder } from '@/utils/api/ApiResponse'

export const dynamic = 'force-dynamic'

function isHandled(
  type: unknown
): type is (typeof HANDLED_RESEND_EVENTS)[number] {
  return (HANDLED_RESEND_EVENTS as readonly unknown[]).includes(type)
}

export async function POST(request: NextRequest) {
  try {
    const verified = verifyResendWebhook(await request.text(), request.headers)
    if (!verified.ok) {
      if (verified.reason === 'not_configured') {
        console.error(
          'Resend webhook: RESEND_WEBHOOK_SECRET or RESEND_API_KEY not configured'
        )
        return NextResponse.json(
          ResponseBuilder.internalError('Webhook not configured'),
          { status: 500 }
        )
      }
      return NextResponse.json(
        ResponseBuilder.unauthorized('Invalid signature'),
        { status: 401 }
      )
    }

    const type =
      typeof verified.event === 'object' && verified.event !== null
        ? (verified.event as { type?: unknown }).type
        : undefined
    if (!isHandled(type)) {
      return NextResponse.json(
        ResponseBuilder.success({
          outcome: 'ignored',
          reason: `${String(type)} is not handled`,
        })
      )
    }

    const parsed = resendWebhookEventSchema.safeParse(verified.event)
    if (!parsed.success) {
      console.error('Resend webhook: unusable payload', parsed.error.issues)
      return NextResponse.json(
        ResponseBuilder.success({ outcome: 'invalid_payload' })
      )
    }

    // Service-role: a webhook has no session, and the outreach tables have
    // RLS on with no policies.
    const result = await createHandleMailingEvent(createAdminClient()).execute(
      parsed.data
    )
    return NextResponse.json(ResponseBuilder.success(result))
  } catch (error) {
    console.error('Resend webhook error:', error)
    // Opaque: Resend is not an operator of this system (rule 2.8).
    return NextResponse.json(
      ResponseBuilder.internalError('Failed to process the event'),
      { status: 500 }
    )
  }
}

/**
 * GET — configuration probe. Reports only whether the secret is present,
 * never its value.
 */
export async function GET() {
  return NextResponse.json(
    ResponseBuilder.success({
      configured: !!process.env.RESEND_WEBHOOK_SECRET?.trim(),
      endpoint: '/api/webhooks/resend',
      method: 'POST',
      events: HANDLED_RESEND_EVENTS,
    })
  )
}
