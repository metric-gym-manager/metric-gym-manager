import { NextResponse } from 'next/server';
import { getApiGymProfile } from '@/lib/middleware/api-auth';

// ============================================================
// GET /api/auth/profile - Get current user's gym profile
// ============================================================

export async function GET() {
  const { gymProfile, error } = await getApiGymProfile();

  if (error) {
    return error;
  }

  return NextResponse.json(
    {
      success: true,
      data: gymProfile,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-cache',
      },
    }
  );
}
