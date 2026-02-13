import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { updatePlanTypeSchema } from '@/features/settings/schemas/settings.schemas';
import { getPlanTypes, updatePlanType } from '@/features/settings/services/settings.service';

// ============================================================
// GET /api/settings/plans - Get plan types
// ============================================================

export async function GET(_request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();

    const planTypes = await getPlanTypes(gymProfile.id);

    return NextResponse.json(
      {
        success: true,
        data: planTypes,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get plan types API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch plan types' },
      { status: 500 }
    );
  }
}

// ============================================================
// PATCH /api/settings/plans - Update plan type
// ============================================================

export async function PATCH(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();
    const body = await request.json();

    // Validate input
    const validatedData = updatePlanTypeSchema.parse(body);

    // Update plan type
    const planType = await updatePlanType(gymProfile.id, validatedData);

    return NextResponse.json(
      {
        success: true,
        data: planType,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update plan type API error:', error);

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
      { success: false, error: 'Failed to update plan type' },
      { status: 500 }
    );
  }
}
