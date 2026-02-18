import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Verification token is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify the email change with Supabase
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'email_change',
    });

    if (error) {
      console.error('Email verification error:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid or expired verification link' },
        { status: 400 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        { success: false, error: 'Failed to verify email' },
        { status: 400 }
      );
    }

    // Update the gyms table to mark email as verified
    const { error: updateError } = await supabase
      .from('gyms')
      .update({
        email: data.user.email,
        email_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', data.user.id);

    if (updateError) {
      console.error('Failed to update gym email verification status:', updateError);
      // Don't fail the request - Supabase verified the email successfully
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    console.error('Unexpected error in email verification:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
