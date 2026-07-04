import { NextRequest, NextResponse } from 'next/server';
import { getAdminContainer } from '@/infrastructure/di';
import { ResponseBuilder } from '@/core/utils/api/ApiResponse';
import { safeEqual } from '@/lib/auth/safeEqual';

export const runtime = 'nodejs';

// ============================================================
// GET /api/admin/system-health/billing-failures
// SaaS-admin-only PayHere failure feed (saas_payment_logs where
// status_code < 2 OR signature_valid = false, newest first).
//
// CRITICAL: authorization runs BEFORE any database access
// (architecture §1). Full technical detail is allowed HERE ONLY —
// this surface never reaches gym managers.
// ============================================================

export async function GET(request: NextRequest) {
  try {
    // --- Strict authorization first (constant-time, no fallback secret) ---
    const authHeader = request.headers.get('authorization');
    const adminSecret = process.env.ADMIN_API_SECRET;

    if (!adminSecret) {
      console.error('ADMIN_API_SECRET not configured');
      return NextResponse.json(
        ResponseBuilder.error('Admin API not configured', 'ADMIN_NOT_CONFIGURED'),
        { status: 500 }
      );
    }

    if (!authHeader || !safeEqual(authHeader, `Bearer ${adminSecret}`)) {
      console.warn('Unauthorized admin billing-failures access attempt');
      return NextResponse.json(
        ResponseBuilder.forbidden('Invalid admin credentials'),
        { status: 403 }
      );
    }

    // --- Only now touch the database ---
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0);

    const container = await getAdminContainer();
    const { rows, totalCount } = await container
      .getSaasPaymentLogRepository()
      .listFailures(limit, offset);

    const failures = rows.map((row) => ({
      id: row.id,
      gym_id: row.gymId,
      order_id: row.orderId,
      payhere_payment_id: row.payherePaymentId,
      payhere_subscription_id: row.payhereSubscriptionId,
      status_code: row.statusCode,
      signature_valid: row.signatureValid,
      message_type: row.messageType,
      status_message: row.statusMessage,
      processed_at: row.processedAt.toISOString(),
    }));

    return NextResponse.json(
      ResponseBuilder.success({ failures }, { totalCount, limit, offset }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Billing failures API error:', error);
    return NextResponse.json(
      ResponseBuilder.internalError('Failed to load billing failures'),
      { status: 500 }
    );
  }
}
