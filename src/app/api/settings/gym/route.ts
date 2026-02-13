import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { updateGymInfoSchema } from '@/features/settings/schemas/settings.schemas';
import { updateGymInfo } from '@/features/settings/services/settings.service';

// ============================================================
// PATCH /api/settings/gym - Update gym information
// ============================================================

export async function PATCH(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();
    const body = await request.json();

    // Validate input
    const validatedData = updateGymInfoSchema.parse(body);

    // Update gym info
    const updatedGym = await updateGymInfo(gymProfile.id, validatedData);

    return NextResponse.json(
      {
        success: true,
        data: updatedGym,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update gym info API error:', error);

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
      { success: false, error: 'Failed to update gym information' },
      { status: 500 }
    );
  }
}
