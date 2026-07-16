import { NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { ResponseBuilder } from '@/utils/api/ApiResponse';
import { getOrCreateRegistrationLink } from '@/features/registration/services/registration-link.service';

// ============================================================
// GET /api/settings/registration-link
// The gym's public self-registration link (created lazily)
// ============================================================

export async function GET() {
  try {
    const gymProfile = await getCurrentGymProfile();

    const link = await getOrCreateRegistrationLink(gymProfile.id);

    return NextResponse.json(ResponseBuilder.success(link));
  } catch (error) {
    console.error('Get registration link API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 });
    }

    return NextResponse.json(
      ResponseBuilder.error('Failed to fetch registration link', 'FETCH_ERROR'),
      { status: 500 }
    );
  }
}
