import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentGymProfile } from '@/lib/middleware/auth';

// ============================================================
// POST /api/demo/reset-rate-limits - Reset Rate Limits (demo account only)
// ============================================================

/**
 * Demo endpoint for clearing OTP rate limits during demonstrations.
 *
 * SECURITY: Restricted to the single designated demo account
 * (DEMO_TOOLS_ALLOWED_EMAIL) — the same gate as /api/demo/send-sms.
 * Unauthenticated -> 401; any other account or an unset env var -> 403.
 */
export async function POST() {
  // --- Authorization: designated demo account only ---
  const allowedEmail = process.env.DEMO_TOOLS_ALLOWED_EMAIL;

  let gymProfile;
  try {
    gymProfile = await getCurrentGymProfile();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  if (!allowedEmail || gymProfile.email !== allowedEmail) {
    return NextResponse.json(
      { success: false, error: 'This demo tool is not available for your account.' },
      { status: 403 }
    );
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ Missing Supabase credentials');
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('🧹 [DEMO] Clearing rate limits...');

    // Clear OTP tokens (our custom rate limiting)
    const { error: otpError } = await supabase
      .from('otp_tokens')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (otpError) {
      console.error('   ❌ Failed to clear OTP tokens:', otpError.message);
      return NextResponse.json(
        { success: false, error: 'Failed to clear rate limits' },
        { status: 500 }
      );
    }

    console.log('   ✅ OTP rate limits cleared successfully');

    return NextResponse.json(
      {
        success: true,
        message: 'Rate limits reset successfully',
        cleared: ['otp_tokens'],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Demo reset rate limits API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
