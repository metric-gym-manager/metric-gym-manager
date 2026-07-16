import { NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { getActiveDiscounts } from '@/features/settings/services/settings.service';

// ============================================================
// GET /api/discounts - Get active discounts for the gym
// ============================================================

export async function GET() {
  try {
    const gymProfile = await getCurrentGymProfile();

    const discounts = await getActiveDiscounts(gymProfile.id);

    return NextResponse.json(
      {
        success: true,
        data: discounts,
      },
      { status: 200 }
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
