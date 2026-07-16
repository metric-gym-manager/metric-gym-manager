import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { getAdminContainer } from '@/infrastructure/di';
import { ResponseBuilder } from '@/utils/api/ApiResponse';
import { ConflictError, ExternalServiceError, NotFoundError } from '@/utils/errors';
import { serializeSubscriptionForAPI } from '@/features/subscriptions/utils/serializeSubscriptionForAPI';

export const runtime = 'nodejs';

// ============================================================
// POST /api/billing/cancel — cancel the Pro subscription (JWT)
// Gateway-first: PayHere is told to stop charging BEFORE any local
// write; on gateway failure local state is untouched (plan UC-4).
// ============================================================

export async function POST(_request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();

    const container = await getAdminContainer();
    const subscription = await container
      .getCancelSubscriptionUseCase()
      .execute({ gymId: gymProfile.id });

    return NextResponse.json(
      ResponseBuilder.success(serializeSubscriptionForAPI(subscription)),
      { status: 200 }
    );
  } catch (error) {
    console.error('Billing cancel API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json(ResponseBuilder.conflict(error.message), { status: 409 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json(ResponseBuilder.notFound(error.resource), { status: 404 });
    }
    if (error instanceof ExternalServiceError) {
      // Sanitized (§2.8): no PayHere response bodies to the client
      return NextResponse.json(
        ResponseBuilder.internalError(
          'Could not reach the payment provider — nothing was changed. Please try again.'
        ),
        { status: 500 }
      );
    }

    return NextResponse.json(
      ResponseBuilder.internalError('Failed to cancel subscription'),
      { status: 500 }
    );
  }
}
