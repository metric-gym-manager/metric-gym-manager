import { NextResponse } from 'next/server';
import { getApiGymProfile } from '@/lib/middleware/api-auth';
import { listGymsWithRegistrationLinks } from '@/features/registration/services/registration-link.service';

// ============================================================
// GET /api/admin/qr-codes
// All gyms with their registration QR links (SaaS operator only)
// ============================================================

/**
 * Authorization: SaaS operator only. Requires a valid session whose gym-owner
 * email matches ADMIN_ALLOWED_EMAIL (server-only env var). No client-held secret.
 */
export async function GET() {
  try {
    // CRITICAL: Strict authorization check BEFORE any database queries.
    const { gymProfile, error: authError } = await getApiGymProfile();
    if (authError) {
      return authError; // 401 (no session) or 404 (no gym profile)
    }

    const allowedEmail = process.env.ADMIN_ALLOWED_EMAIL;
    if (!allowedEmail || gymProfile!.email !== allowedEmail) {
      console.warn('Unauthorized admin API access attempt');
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const items = await listGymsWithRegistrationLinks();

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    if (error instanceof Error && error.message === 'Failed to fetch gyms') {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch gyms' },
        { status: 500 }
      );
    }
    console.error('Admin QR codes API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch QR codes' },
      { status: 500 }
    );
  }
}
