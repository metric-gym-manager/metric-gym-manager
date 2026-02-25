import { NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';

// ============================================================
// GET /api/auth/profile - Get current user's gym profile
// ============================================================

export async function GET() {
  try {
    const gymProfile = await getCurrentGymProfile();

    return NextResponse.json(
      {
        success: true,
        data: gymProfile,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error('Get profile API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.message === 'Gym profile not found') {
      return NextResponse.json(
        { success: false, error: 'Gym profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
