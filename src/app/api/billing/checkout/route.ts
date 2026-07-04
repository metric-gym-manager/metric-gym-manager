import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { getAdminContainer } from '@/infrastructure/di';
import { ResponseBuilder } from '@/core/utils/api/ApiResponse';
import { ConflictError, NotFoundError } from '@/core/utils/errors';
import { checkoutCustomerSchema } from '@/features/subscriptions/schemas/subscription.schemas';

// Node crypto (PayHere hash) — never edge runtime
export const runtime = 'nodejs';

// ============================================================
// POST /api/billing/checkout — start a Pro upgrade (JWT)
// Creates the pending checkout intent and returns the PayHere
// redirect (form params + URL) for a browser form POST.
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();
    const body = await request.json();
    const validated = checkoutCustomerSchema.parse(body);

    // Server-side defaults from the gym profile; explicit values override
    const customer = {
      firstName: validated.firstName ?? gymProfile.gym_name,
      lastName: validated.lastName ?? 'Gym',
      email: validated.email ?? gymProfile.email,
      phone: validated.phone ?? gymProfile.phone_number ?? '',
      address: validated.address ?? gymProfile.gym_address ?? '',
      city: validated.city,
    };

    // Admin container on purpose: checkout intents are RLS'd to service_role
    // only, and the caller's gym id was pinned by getCurrentGymProfile() above.
    const container = await getAdminContainer();
    const result = await container
      .getGenerateCheckoutUrlUseCase()
      .execute({ gymId: gymProfile.id, customer });

    return NextResponse.json(
      ResponseBuilder.success({
        checkoutUrl: result.checkoutUrl,
        params: result.params,
        orderId: result.orderId,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Billing checkout API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        ResponseBuilder.validationError({ general: error.errors.map((e) => e.message) }),
        { status: 400 }
      );
    }
    if (error instanceof ConflictError) {
      return NextResponse.json(ResponseBuilder.conflict(error.message), { status: 409 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json(ResponseBuilder.notFound(error.resource), { status: 404 });
    }

    return NextResponse.json(
      ResponseBuilder.internalError('Failed to start checkout'),
      { status: 500 }
    );
  }
}
