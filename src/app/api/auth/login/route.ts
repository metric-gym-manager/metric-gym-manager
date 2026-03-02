import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { loginSchema } from '@/features/auth/schemas/auth.schemas';
import { loginWithPassword } from '@/features/auth/services/auth.service';
import { REMEMBER_ME_COOKIE, REMEMBER_ME_MAX_AGE } from '@/lib/auth-config';

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

    // Persist the "remember me" preference as a cookie so the middleware
    // and server client can set the correct maxAge on auth cookies.
    const cookieStore = await cookies();
    if (validatedData.rememberMe) {
      cookieStore.set(REMEMBER_ME_COOKIE, '1', {
        path: '/',
        sameSite: 'lax',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: REMEMBER_ME_MAX_AGE,
      });
    } else {
      // Ensure any previous "remember me" cookie is cleared so the
      // session becomes a session-cookie (expires on browser close).
      cookieStore.delete(REMEMBER_ME_COOKIE);
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
