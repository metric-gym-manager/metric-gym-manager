import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// POST /api/demo/reset-rate-limits - Reset Rate Limits (Localhost only)
// ============================================================

/**
 * Demo endpoint for clearing OTP rate limits during demonstrations.
 * SECURITY: Only works on localhost. Rejects all production requests.
 */
export async function POST(request: NextRequest) {
  // SECURITY: Only allow localhost
  const host = request.headers.get('host') || '';
  if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
    return NextResponse.json(
      { success: false, error: 'Demo endpoint only available on localhost' },
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
