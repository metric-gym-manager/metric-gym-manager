import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { createClient } from '@/lib/supabase/server';
import { createGymSubscriptionRepository, createSaasPaymentLogRepository } from '@/features/subscriptions';
import { ResponseBuilder } from '@/utils/api/ApiResponse';
import { SaasStatus } from '@/features/subscriptions/config/SubscriptionConfig';
import { classifyRecurringFailure } from '@/features/subscriptions/domain/classifyRecurringFailure';
import { serializeSubscriptionForAPI } from '@/features/subscriptions/utils/serializeSubscriptionForAPI';
import { getPayhereConfig } from '@/lib/payhere/config';

/** Per-tier price for the pricing UI; null when billing env is not configured. */
function priceOrNull(which: 'lite' | 'pro' | 'enterprise'): number | null {
  try {
    const config = getPayhereConfig();
    switch (which) {
      case 'lite':
        return config.litePriceLkr;
      case 'pro':
        return config.proPriceLkr;
      case 'enterprise':
        return config.enterprisePriceLkr;
    }
  } catch {
    return null;
  }
}

// ============================================================
// GET /api/settings/subscription — current gym's subscription (JWT)
// Powers the billing page and the post-redirect verification poll.
// Session client on purpose: RLS scopes the reads (defense in depth).
// ============================================================

export async function GET(_request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();

    const supabase = await createClient();
    const subscription = await createGymSubscriptionRepository(supabase).findByGymId(
      gymProfile.id
    );

    if (!subscription) {
      return NextResponse.json(ResponseBuilder.notFound('Subscription'), { status: 404 });
    }

    // Sanitized past-due reason (plan C-22): class token only, never raw text
    let pastDueReason = null;
    if (subscription.status === SaasStatus.PastDue) {
      const latestFailure = await createSaasPaymentLogRepository(
        supabase
      ).findLatestFailure(gymProfile.id);
      if (latestFailure) {
        pastDueReason = classifyRecurringFailure(
          latestFailure.statusCode,
          latestFailure.messageType
        );
      }
    }

    return NextResponse.json(
      ResponseBuilder.success(serializeSubscriptionForAPI(subscription, pastDueReason), {
        litePriceLkr: priceOrNull('lite'),
        proPriceLkr: priceOrNull('pro'),
        enterprisePriceLkr: priceOrNull('enterprise'),
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Get subscription API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 });
    }

    return NextResponse.json(
      ResponseBuilder.internalError('Failed to load subscription'),
      { status: 500 }
    );
  }
}
