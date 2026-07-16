import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { getContainer } from '@/infrastructure/di';
import { ResponseBuilder } from '@/utils/api/ApiResponse';
import { SaasStatus } from '@/core/utils/constants/SubscriptionConfig';
import { classifyRecurringFailure } from '@/core/domain/subscription/classifyRecurringFailure';
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
// Session container on purpose: RLS scopes the reads (defense in depth).
// ============================================================

export async function GET(_request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();

    const container = await getContainer();
    const subscription = await container
      .getGymSubscriptionRepository()
      .findByGymId(gymProfile.id);

    if (!subscription) {
      return NextResponse.json(ResponseBuilder.notFound('Subscription'), { status: 404 });
    }

    // Sanitized past-due reason (plan C-22): class token only, never raw text
    let pastDueReason = null;
    if (subscription.status === SaasStatus.PastDue) {
      const latestFailure = await container
        .getSaasPaymentLogRepository()
        .findLatestFailure(gymProfile.id);
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
