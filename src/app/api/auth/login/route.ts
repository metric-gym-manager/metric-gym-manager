import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '@/features/auth/schemas/auth.schemas';
import { loginWithPassword } from '@/features/auth/services/auth.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = loginSchema.parse(body);

    // Login
    const result = await loginWithPassword(validatedData);

    if (!result.success) {
      // Check if error is related to email verification
      const isEmailVerificationError =
        result.error?.toLowerCase().includes('verify') ||
        result.error?.toLowerCase().includes('confirm');

      return NextResponse.json(
        {
          success: false,
          error: result.error,
          errorCode: isEmailVerificationError ? 'email_verification_required' : undefined,
        },
        { status: isEmailVerificationError ? 403 : 401 }
      );
    }

    // Check if email verification is required
    if (result.data?.requiresEmailVerification) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please verify your email before logging in. Check your inbox (including spam folder) for the verification link.',
          errorCode: 'email_verification_required',
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Login API error:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid input data' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
