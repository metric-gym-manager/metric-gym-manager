import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getApiGymProfile } from '@/lib/middleware/api-auth';
import { buildJoinUrl } from '@/features/registration/services/registration-link.service';

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

    const supabase = createAdminClient();

    const { data: gyms, error: gymsError } = await supabase
      .from('gyms')
      .select(
        'id, gym_name, username, email, gym_registration_links(token, is_active, created_at, rotated_at)'
      )
      .order('gym_name', { ascending: true });

    if (gymsError) {
      console.error('Failed to fetch gyms for QR dashboard:', gymsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch gyms' },
        { status: 500 }
      );
    }

    // Backfill links for any gym that doesn't have one yet (gyms created
    // before the migration backfill, or edge cases)
    const gymsWithoutLink = (gyms ?? []).filter(
      (gym) =>
        !gym.gym_registration_links ||
        (Array.isArray(gym.gym_registration_links) &&
          gym.gym_registration_links.length === 0)
    );

    const backfilledTokens = new Map<string, string>();
    for (const gym of gymsWithoutLink) {
      const token = randomBytes(16).toString('hex');
      const { error: insertError } = await supabase
        .from('gym_registration_links')
        .insert({ gym_id: gym.id, token });
      if (!insertError) {
        backfilledTokens.set(gym.id, token);
      }
    }

    const items = (gyms ?? []).map((gym) => {
      const linkRelation = gym.gym_registration_links;
      const link = Array.isArray(linkRelation) ? linkRelation[0] : linkRelation;
      const token = (link?.token as string | undefined) ?? backfilledTokens.get(gym.id) ?? null;

      return {
        gymId: gym.id,
        gymName: gym.gym_name,
        username: gym.username,
        email: gym.email,
        token,
        joinUrl: token ? buildJoinUrl(token) : null,
        isActive: link?.is_active ?? true,
        rotatedAt: link?.rotated_at ?? null,
      };
    });

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error('Admin QR codes API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch QR codes' },
      { status: 500 }
    );
  }
}
