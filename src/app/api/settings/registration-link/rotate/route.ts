import { NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { ResponseBuilder } from '@/core/utils/api/ApiResponse';
import { rotateRegistrationLink } from '@/features/registration/services/registration-link.service';

// ============================================================
// POST /api/settings/registration-link/rotate
// Regenerate the gym's registration token
// ============================================================

/**
 * Rotates the self-registration token. Previously printed QR posters stop
 * working immediately — the UI warns before calling this.
 */
export async function POST() {
  try {
    const gymProfile = await getCurrentGymProfile();

    const link = await rotateRegistrationLink(gymProfile.id);

    return NextResponse.json(
      ResponseBuilder.success(link, {
        message: 'Registration link regenerated. Reprint your QR code.',
      })
    );
  } catch (error) {
    console.error('Rotate registration link API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 });
    }

    return NextResponse.json(
      ResponseBuilder.error('Failed to regenerate registration link', 'ROTATE_ERROR'),
      { status: 500 }
    );
  }
}
