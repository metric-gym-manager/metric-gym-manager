import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const resendSchema = z.object({
  email: z.string().email('Invalid email address'),
});

/**
 * Resend Email Confirmation
 *
 * Allows users to request a new verification email if:
 * - Original email was not received
 * - Email expired (24 hours)
 * - Email went to spam
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = resendSchema.parse(body);
    const supabase = await createClient();

    console.log(`📧 Attempting to resend verification email to: ${validatedData.email}`);

    // Resend confirmation email
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: validatedData.email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });

    if (error) {
      console.error('❌ Resend email failed:', error.message);
    } else {
      console.log('✅ Verification email resent successfully to:', validatedData.email);
    }

    if (error) {
      // Check for specific error types
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Too many requests. Please try again in a few minutes.',
          },
          { status: 429 }
        );
      }

      if (error.message.includes('not found') || error.message.includes('User not found')) {
        return NextResponse.json(
          {
            success: false,
            error: 'No account found with this email address.',
          },
          { status: 404 }
        );
      }

      console.error('Resend confirmation error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to resend confirmation email',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Confirmation email sent! Please check your inbox.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Resend confirmation API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email address',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
