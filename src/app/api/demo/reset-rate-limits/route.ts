import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Demo API for resetting OTP rate limits
 * Only accessible from localhost
 *
 * This clears old OTP tokens from the database to allow repeated
 * demonstrations without hitting rate limits.
 */
export async function POST(request: NextRequest) {
  try {
    // Check if request is from localhost
    const host = request.headers.get('host') || '';
    const isLocalhost =
      host.startsWith('localhost') ||
      host.startsWith('127.0.0.1') ||
      host.startsWith('[::1]');

    if (!isLocalhost) {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is only accessible from localhost.' },
        { status: 403 }
      );
    }

    const supabase = await createClient();

    // Delete OTP tokens older than 1 hour to reset rate limits
    // This allows fresh OTP requests for demonstration purposes
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { error: deleteError, count } = await supabase
      .from('otp_tokens')
      .delete()
      .lte('created_at', oneHourAgo);

    if (deleteError) {
      console.error('Failed to reset rate limits:', deleteError);
      return NextResponse.json(
        { error: 'Failed to reset rate limits' },
        { status: 500 }
      );
    }

    console.log(`🔄 [DEMO] Reset rate limits - deleted ${count || 0} old OTP tokens`);

    return NextResponse.json({
      success: true,
      deletedCount: count || 0,
      message: 'Rate limits reset successfully',
    });
  } catch (error) {
    console.error('Rate limit reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset rate limits' },
      { status: 500 }
    );
  }
}
