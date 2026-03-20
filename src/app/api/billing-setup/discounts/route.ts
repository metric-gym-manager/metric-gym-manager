import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { createDiscountSchema } from '@/features/settings/schemas/settings.schemas';
import { getDiscounts, createDiscount } from '@/features/settings/services/settings.service';

// ============================================================
// GET /api/billing-setup/discounts - Get discounts
// ============================================================

export async function GET(_request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();

    const discounts = await getDiscounts(gymProfile.id);

    return NextResponse.json(
      {
        success: true,
        data: discounts,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    console.error('Get discounts API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch discounts' },
      { status: 500 }
    );
  }
}

// ============================================================
// POST /api/billing-setup/discounts - Create discount
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();
    const body = await request.json();

    // Validate input
    const validatedData = createDiscountSchema.parse(body);

    // Create discount
    const discount = await createDiscount(gymProfile.id, validatedData);

    return NextResponse.json(
      {
        success: true,
        data: discount,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create discount API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid input data' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create discount' },
      { status: 500 }
    );
  }
}
