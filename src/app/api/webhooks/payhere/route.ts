import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getPayHereGateway,
  createSaasPaymentLogRepository,
  createHandlePayHereWebhook,
} from '@/features/subscriptions';
import { ResponseBuilder } from '@/utils/api/ApiResponse';

// Node crypto (md5sig verification) + service-role writes
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================
// POST /api/webhooks/payhere — PayHere server-to-server notify_url (public)
//
// Contract (plan §RT / final invariant 2):
//   * 200 for EVERY business outcome: success, pending, failed payment,
//     duplicate delivery, unresolved gym, invalid signature, garbage body.
//     HTTP status is NEVER derived from PayHere's status_code.
//   * 500 ONLY for genuine transient faults (DB down) so PayHere retries.
//   * md5sig is verified before any processing and never logged (redacted).
// ============================================================

export async function POST(request: NextRequest) {
  // --- Parse the form-urlencoded body (PayHere never posts JSON) ---
  let fields: Record<string, string>;
  try {
    const formData = await request.formData();
    fields = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') {
        fields[key] = value; // raw strings verbatim — signature hashes exact bytes
      }
    }
  } catch {
    // Not a form post — not from PayHere. Acknowledge and reveal nothing.
    return NextResponse.json(ResponseBuilder.success({ received: true }), { status: 200 });
  }

  const supabase = createAdminClient();

  // --- Signature gate (before any state read/write) ---
  const signatureValid = getPayHereGateway().verifyNotificationSignature(fields);

  if (!signatureValid) {
    // Best-effort capped audit (plan C-20); never throws, never leaks md5sig
    const statusCode = Number.parseInt(fields.status_code ?? '', 10);
    await createSaasPaymentLogRepository(supabase).insertInvalid({
      gymId: null,
      orderId: fields.order_id ?? null,
      payherePaymentId: fields.payment_id ?? null,
      payhereSubscriptionId: fields.subscription_id ?? null,
      statusCode: Number.isNaN(statusCode) ? 0 : statusCode,
      signatureValid: false,
      messageType: fields.message_type ?? null,
      statusMessage: fields.status_message ?? null,
      rawPayload: { ...fields, md5sig: '[REDACTED]' },
    });
    return NextResponse.json(ResponseBuilder.success({ received: true }), { status: 200 });
  }

  // --- Synchronous, idempotent processing (plan C-25: conscious deviation
  //     from verify-enqueue-ack; PayHere retry-on-non-2xx is the durability layer) ---
  try {
    const { outcome } = await createHandlePayHereWebhook(supabase).execute(fields);
    return NextResponse.json(
      ResponseBuilder.success({ received: true, outcome }),
      { status: 200 }
    );
  } catch (error) {
    // Transient/server fault -> 500 so PayHere RETRIES. Business outcomes
    // (duplicates, mismatches, stale events) never throw — they return outcomes.
    console.error('PayHere webhook processing failed:', error);
    return NextResponse.json(
      ResponseBuilder.internalError(
        'Webhook processing failed',
        error instanceof Error ? error.stack : undefined
      ),
      { status: 500 }
    );
  }
}
