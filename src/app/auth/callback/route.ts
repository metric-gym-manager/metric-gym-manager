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
    } else {
      // Profile doesn't exist - create it from user metadata
      const metadata = user.user_metadata;

      if (!metadata.username || !metadata.gym_name) {
        console.error('Missing required metadata:', metadata);
        return NextResponse.redirect(
          `${requestUrl.origin}/login?error=incomplete_registration`
        );
      }

      // CRITICAL: Check username uniqueness again (prevents race condition)
      // Between registration and email verification, another user might have taken the username
      const { data: usernameCheck } = await adminClient
        .from('gyms')
        .select('username')
        .eq('username', metadata.username)
        .single();

      if (usernameCheck) {
        console.error(`Username '${metadata.username}' already taken during verification`);
        // Delete the auth user since they can't complete registration
        await adminClient.auth.admin.deleteUser(user.id);
        return NextResponse.redirect(
          `${requestUrl.origin}/login?error=username_taken`
        );
      }

      // Create gym profile
      const { error: gymError } = await adminClient.from('gyms').insert({
        user_id: user.id,
        username: metadata.username,
        email: user.email!,
        email_verified: true, // Verified at creation time
        gym_name: metadata.gym_name,
        gym_address: metadata.gym_address || null,
        gym_website: metadata.gym_website || null,
      });

      if (gymError) {
        console.error('Failed to create gym profile:', gymError);
        return NextResponse.redirect(
          `${requestUrl.origin}/login?error=profile_creation_failed`
        );
      }

      // Initialize default plan types
      const { data: gym } = await adminClient
        .from('gyms')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (gym) {
        const defaultPlans = [
          { gym_id: gym.id, plan_type: 'monthly', default_amount: 5000.0 },
          { gym_id: gym.id, plan_type: 'daily', default_amount: 300.0 },
          { gym_id: gym.id, plan_type: 'annual', default_amount: 50000.0 },
        ];

        await adminClient.from('plan_types').insert(defaultPlans);
        console.log(`✅ Created gym profile and plan types for user ${user.id}`);
      }
    }

    // Redirect to dashboard (user is now authenticated)
    return NextResponse.redirect(`${requestUrl.origin}${next}`);
  } catch (error) {
    console.error('Unexpected error in auth callback:', error);
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=unexpected_error`
    );
  }
}
