import { NextRequest, NextResponse } from 'next/server';
import { type EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Auth Callback Handler (PKCE Flow)
 *
 * This route is called when users click email verification links.
 * It verifies the OTP token hash and creates the gym profile.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null;
  const next = requestUrl.searchParams.get('next') || '/members';

  // No token_hash provided - redirect to login with error
  if (!token_hash || !type) {
    console.error('No verification token provided');
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=missing_code`
    );
  }

  try {
    const supabase = await createClient();

    // Verify OTP using token hash (PKCE flow)
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (verifyError || !data.user) {
      console.error('Failed to verify OTP:', verifyError);
      return NextResponse.redirect(
        `${requestUrl.origin}/login?error=verification_failed`
      );
    }

    const user = data.user;

    // Check if gym profile already exists (in case of re-confirmation)
    const adminClient = createAdminClient();
    const { data: existingGym } = await adminClient
      .from('gyms')
      .select('id, email_verified')
      .eq('user_id', user.id)
      .single();

    if (existingGym) {
      // Profile exists - just update email_verified status
      if (!existingGym.email_verified) {
        await adminClient
          .from('gyms')
          .update({ email_verified: true, updated_at: new Date().toISOString() })
          .eq('user_id', user.id);

        console.log(`✅ Email verified for user ${user.id}`);
      }

      // Profile already exists, redirect to dashboard
      return NextResponse.redirect(`${requestUrl.origin}${next}`);
    }

    // NOTE: Profile creation now happens immediately on registration (not here).
    // If we reach this point, the profile should already exist but wasn't found.
    // This is an error state that shouldn't normally occur.
    console.error(`No gym profile found for user ${user.id} after verification`);
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=profile_not_found`
    );
  } catch (error) {
    console.error('Unexpected error in auth callback:', error);
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=unexpected_error`
    );
  }
}
