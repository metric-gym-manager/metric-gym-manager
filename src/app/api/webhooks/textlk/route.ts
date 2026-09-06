/**
 * text.lk delivery-receipt webhook.
 *
 * Receives delivery status updates and applies them to `sms_logs`. Configure the
 * endpoint URL in the text.lk dashboard.
 *
 * ## Why this file was rewritten
 *
 * Every delivery report the vendor ever sent was discarded. Three independent
 * defects, each sufficient on its own:
 *
 * 1. The update wrote `updated_at`, a column `sms_logs` does not have, so
 *    PostgREST rejected the request outright.
 * 2. It used a **session** client. A webhook carries no cookies, so `auth.uid()`
 *    is null — and `sms_logs` has no UPDATE policy for any caller anyway.
 * 3. The update ran without `.select()`, and PostgREST reports no error for an
 *    update that matched no rows. So once (1) was fixed, the RLS refusal in (2)
 *    would have been reported as **success**: the handler logged
 *    `✓ Updated SMS … to delivered` and returned 200 having changed nothing.
 *
 * Production bore this out: 1,137 dispatched messages over seven months, every
 * one still sitting on the `sent` default, and not one row ever `delivered`.
 *
 * The fix is all three together — service-role client (R7), correct columns, and
 * a repository that returns rows-affected so a no-op is detectable.
 *
 * ## Response contract
 *
 * **Always 200 for business outcomes**, matching the PayHere and access-control
 * webhooks (§2.13, §2.21). An unknown message id, an already-terminal row, or a
 * vendor status we do not recognise are all facts about the payload, not
 * failures of ours, and a retry can never change them. Non-2xx is reserved for
 * "we could not process this and a retry might work": a bad signature (401) or
 * an unexpected exception (500).
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRecordSmsDeliveryReceipt } from '@/features/sms/services/factory'
import { ResponseBuilder } from '@/utils/api/ApiResponse'

const deliveryReceiptSchema = z.object({
  message_id: z.string().min(1),
  status: z.string().min(1),
  timestamp: z.string().optional(),
  recipient: z.string().optional(),
})

/**
 * Constant-time signature comparison.
 *
 * `a !== b` on a hex digest leaks, through timing, how many leading characters
 * of a forged signature were correct — enough to derive a valid one byte by
 * byte. `timingSafeEqual` requires equal-length buffers, so a wrong-length
 * signature is rejected before the comparison rather than throwing.
 */
function signaturesMatch(received: string, expected: string): boolean {
  const a = Buffer.from(received, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-textlk-signature')
    const body = await request.text()

    const webhookSecret = process.env.TEXT_LK_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('text.lk webhook: TEXT_LK_WEBHOOK_SECRET not configured')
      return NextResponse.json(
        ResponseBuilder.internalError('Webhook not configured'),
        { status: 500 }
      )
    }

    if (!signature) {
      return NextResponse.json(
        ResponseBuilder.unauthorized('Missing signature header'),
        { status: 401 }
      )
    }

    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex')

    if (!signaturesMatch(signature, expected)) {
      console.error('text.lk webhook: invalid signature')
      return NextResponse.json(
        ResponseBuilder.unauthorized('Invalid signature'),
        { status: 401 }
      )
    }

    const parsed = deliveryReceiptSchema.safeParse(JSON.parse(body))
    if (!parsed.success) {
      // A malformed payload is not going to become well-formed on retry, so this
      // is a 200 with the outcome stated, not a 400 the vendor will re-send.
      console.error('text.lk webhook: unusable payload', parsed.error.issues)
      return NextResponse.json(
        ResponseBuilder.success({ outcome: 'invalid_payload' }),
        { status: 200 }
      )
    }

    // Service-role: `sms_logs` has no UPDATE policy, so this is the only client
    // whose write is not silently refused.
    const result = await createRecordSmsDeliveryReceipt(
      createAdminClient()
    ).execute({
      messageId: parsed.data.message_id,
      vendorStatus: parsed.data.status,
    })

    if (result.outcome === 'unknown_status') {
      console.warn(
        `text.lk webhook: unrecognised status "${result.vendorStatus}" for ` +
          `${parsed.data.message_id} — no change written`
      )
    } else if (result.outcome === 'no_matching_row') {
      console.warn(
        `text.lk webhook: no row for message ${result.messageId} ` +
          '(unknown id, or already in a terminal state)'
      )
    }

    return NextResponse.json(ResponseBuilder.success(result), { status: 200 })
  } catch (error) {
    console.error('text.lk webhook error:', error)
    // Deliberately opaque: the vendor is not an operator of this system and gets
    // no internal detail (rule 2.8). A retry is welcome, hence 500.
    return NextResponse.json(
      ResponseBuilder.internalError('Failed to process delivery receipt'),
      { status: 500 }
    )
  }
}

/**
 * GET — configuration probe for setup and debugging. Reports only whether the
 * secret is present, never its value.
 */
export async function GET() {
  return NextResponse.json(
    ResponseBuilder.success({
      configured: !!process.env.TEXT_LK_WEBHOOK_SECRET,
      endpoint: '/api/webhooks/textlk',
      method: 'POST',
      signatureHeader: 'x-textlk-signature',
    })
  )
}
