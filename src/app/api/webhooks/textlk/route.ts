/**
 * text.lk Webhook Handler
 *
 * Receives delivery status updates from text.lk API and updates SMS logs.
 * Webhook must be configured in text.lk dashboard with this endpoint URL.
 *
 * Expected webhook payload:
 * {
 *   "message_id": "msg_abc123",
 *   "status": "DELIVERED" | "FAILED" | "SENT" | "PENDING" | "EXPIRED" | "REJECTED",
 *   "timestamp": "2024-02-12T10:30:00Z",
 *   "recipient": "+94771234567"
 * }
 *
 * Security: Validates webhook signature using HMAC SHA-256
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

/**
 * POST /api/webhooks/textlk
 *
 * Handles delivery status updates from text.lk
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature for security
    const signature = request.headers.get('x-textlk-signature');
    const body = await request.text();

    if (!signature) {
      console.error('text.lk webhook: Missing signature header');
      return NextResponse.json(
        { error: 'Missing signature header' },
        { status: 401 }
      );
    }

    // Validate signature using webhook secret
    const webhookSecret = process.env.TEXT_LK_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('text.lk webhook: TEXT_LK_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      );
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('text.lk webhook: Invalid signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse webhook payload
    const payload = JSON.parse(body);
    const { message_id, status, timestamp, recipient } = payload;

    if (!message_id || !status) {
      console.error('text.lk webhook: Missing required fields', payload);
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Map text.lk status to our delivery status
    let deliveryStatus: 'sent' | 'delivered' | 'failed';

    switch (status) {
      case 'DELIVERED':
        deliveryStatus = 'delivered';
        break;
      case 'FAILED':
      case 'EXPIRED':
      case 'REJECTED':
        deliveryStatus = 'failed';
        break;
      case 'SENT':
      case 'PENDING':
      default:
        deliveryStatus = 'sent';
        break;
    }

    // Update SMS log in database
    const supabase = await createClient();

    const { error: updateError } = await supabase
      .from('sms_logs')
      .update({
        delivery_status: deliveryStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('text_lk_message_id', message_id);

    if (updateError) {
      console.error('text.lk webhook: Failed to update SMS log:', updateError);
      return NextResponse.json(
        { error: 'Failed to update SMS log' },
        { status: 500 }
      );
    }

    console.log(
      `✓ text.lk webhook: Updated SMS ${message_id} to ${deliveryStatus}`
    );

    // Return success response
    return NextResponse.json({
      success: true,
      message_id,
      status: deliveryStatus,
    });
  } catch (error) {
    console.error('text.lk webhook error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/textlk
 *
 * Returns webhook configuration info (for debugging)
 */
export async function GET() {
  const isConfigured = !!process.env.TEXT_LK_WEBHOOK_SECRET;

  return NextResponse.json({
    configured: isConfigured,
    endpoint: '/api/webhooks/textlk',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-textlk-signature': 'HMAC SHA-256 signature',
    },
    note: 'Configure this webhook URL in text.lk dashboard',
  });
}
