import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createChangePlan } from '@/features/subscriptions';
import { ResponseBuilder } from '@/utils/api/ApiResponse';
import {
  ChargeFailedError,
  ConflictError,
  NoSavedCardError,
  NotFoundError,
} from '@/utils/errors';
import { changePlanSchema } from '@/features/subscriptions/schemas/subscription.schemas';
import { serializeSubscriptionForAPI } from '@/features/subscriptions/utils/serializeSubscriptionForAPI';

export const runtime = 'nodejs';

// ============================================================
// POST /api/billing/change-plan — one-click tier change (JWT)
// Charges the gym's STORED CARD TOKEN for the target tier's full month
// (Charging API — no redirect, no card re-entry) and applies the change with
// the credit-preserving period extension: unused days of the current period
// are banked onto the new one. Falls back to checkout via NO_SAVED_CARD.
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();
    const body = await request.json();
    const validated = changePlanSchema.parse(body);

    // Admin container on purpose: charge attempts + subscription writes are
    // RLS'd to service_role only, and the caller's gym id was pinned by
    // getCurrentGymProfile() above. targetTier is a validated enum; the PRICE
    // is always looked up server-side (amount-authority invariant).
    const result = await createChangePlan(
      createAdminClient()
    ).execute({ gymId: gymProfile.id, targetTier: validated.targetTier });

    return NextResponse.json(
      ResponseBuilder.success(serializeSubscriptionForAPI(result.subscription), {
        outcome: result.outcome,
      }),
      { status: result.outcome === 'applied' ? 200 : 202 }
    );
  } catch (error) {
    console.error('Billing change-plan API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        ResponseBuilder.validationError({ general: error.errors.map((e) => e.message) }),
        { status: 400 }
      );
    }
    if (error instanceof NoSavedCardError) {
      // Client falls back to the full PayHere checkout on this code.
      return NextResponse.json(ResponseBuilder.error(error.message, 'NO_SAVED_CARD'), {
        status: 409,
      });
    }
    if (error instanceof ChargeFailedError) {
      return NextResponse.json(ResponseBuilder.error(error.message, 'CHARGE_FAILED'), {
        status: 402,
      });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json(ResponseBuilder.conflict(error.message), { status: 409 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json(ResponseBuilder.notFound(error.resource), { status: 404 });
    }

    return NextResponse.json(
      ResponseBuilder.internalError('Failed to change plan'),
      { status: 500 }
    );
  }
}
