import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { getContainer } from '@/infrastructure/di';
import { ResponseBuilder } from '@/utils/api/ApiResponse';
import { billingHistoryQuerySchema } from '@/features/subscriptions/schemas/subscription.schemas';

// ============================================================
// GET /api/billing/history — gym-facing SaaS billing history (JWT)
// Source of truth: saas_payment_logs (plan C-12). Session container:
// the gym-owner SELECT RLS policy scopes the rows.
// Field WHITELIST only — never the raw payload (§2.8 sanitization).
// ============================================================

/** Coarse per-row status for the UI. */
function rowStatus(statusCode: number): 'paid' | 'pending' | 'failed' {
  if (statusCode === 2) return 'paid';
  if (statusCode === 0) return 'pending';
  return 'failed';
}

export async function GET(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();

    const searchParams = request.nextUrl.searchParams;
    const { page, limit } = billingHistoryQuerySchema.parse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });

    const container = await getContainer();
    const { rows, totalCount } = await container
      .getSaasPaymentLogRepository()
      .listByGym(gymProfile.id, page, limit);

    const payments = rows.map((row) => ({
      id: row.id,
      date: row.processedAt.toISOString().split('T')[0],
      orderId: row.orderId,
      order_id: row.orderId,
      paymentId: row.payherePaymentId,
      payment_id: row.payherePaymentId,
      status: rowStatus(row.statusCode),
      // Whitelisted amount fields from the notification — nothing else leaves raw_payload
      amount: row.rawPayload.payhere_amount ?? null,
      currency: row.rawPayload.payhere_currency ?? null,
    }));

    return NextResponse.json(
      ResponseBuilder.success(
        { payments },
        {
          page,
          limit,
          totalCount,
          totalPages: Math.max(1, Math.ceil(totalCount / limit)),
        }
      ),
      { status: 200 }
    );
  } catch (error) {
    console.error('Billing history API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        ResponseBuilder.validationError({ general: ['Invalid pagination parameters'] }),
        { status: 400 }
      );
    }

    return NextResponse.json(
      ResponseBuilder.internalError('Failed to load billing history'),
      { status: 500 }
    );
  }
}
