import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { loginSchema } from '@/features/auth/schemas/auth.schemas'
import { loginWithPassword } from '@/features/auth/services/auth.service'
import { REMEMBER_ME_COOKIE, REMEMBER_ME_MAX_AGE } from '@/lib/auth-config'
import { checkRateLimit } from '@/lib/rate-limit'
import { rejectCrossSiteRequest } from '@/lib/middleware/sameOrigin'

/**
 * Sign-in attempts allowed per window (remote day F-09).
 *
 * The endpoint used to answer an unbounded number of password guesses. These
 * limits are in-memory and per serverless instance, so they dampen guessing
 * rather than guarantee a global cap. The address limit is looser than the
 * email limit because many people share one gym network.
 */
const LOGIN_IP_LIMIT = 10
const LOGIN_EMAIL_LIMIT = 5
const LOGIN_WINDOW_MS = 15 * 60_000

function rateLimited() {
  return NextResponse.json(
    {
      success: false,
      error: 'Too many sign-in attempts. Wait 15 minutes and try again.',
      errorCode: 'rate_limited',
    },
    { status: 429 }
  )
}

export async function POST(request: NextRequest) {
  // Login CSRF: another site must not be able to sign this browser in.
  const crossSite = rejectCrossSiteRequest(request)
  if (crossSite) return crossSite

  try {
    // Before the body is even read: a flood from one address costs nothing.
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

    if (!checkRateLimit(`login:ip:${ip}`, LOGIN_IP_LIMIT, LOGIN_WINDOW_MS)) {
      return rateLimited()
    }

    const body = await request.json()

    // Validate input
    const validatedData = loginSchema.parse(body)

    // Per account, whatever addresses the guesses come from.
    if (
      !checkRateLimit(
        `login:email:${validatedData.email.toLowerCase()}`,
        LOGIN_EMAIL_LIMIT,
        LOGIN_WINDOW_MS
      )
    ) {
      return rateLimited()
    }

    // Login
    const result = await loginWithPassword(validatedData)

    if (!result.success) {
      // Check if error is related to email verification
      const isEmailVerificationError =
        result.error?.toLowerCase().includes('verify') ||
        result.error?.toLowerCase().includes('confirm')

      return NextResponse.json(
        {
          success: false,
          error: result.error,
          errorCode: isEmailVerificationError
            ? 'email_verification_required'
            : undefined,
        },
        { status: isEmailVerificationError ? 403 : 401 }
      )
    }

    // Check if email verification is required
    if (result.data?.requiresEmailVerification) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Please verify your email before logging in. Check your inbox (including spam folder) for the verification link.',
          errorCode: 'email_verification_required',
        },
        { status: 403 }
      )
    }

    // Persist the "remember me" preference as a cookie so the middleware
    // and server client can set the correct maxAge on auth cookies.
    const cookieStore = await cookies()
    if (validatedData.rememberMe) {
      cookieStore.set(REMEMBER_ME_COOKIE, '1', {
        path: '/',
        sameSite: 'lax',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: REMEMBER_ME_MAX_AGE,
      })
    } else {
      // Ensure any previous "remember me" cookie is cleared so the
      // session becomes a session-cookie (expires on browser close).
      cookieStore.delete(REMEMBER_ME_COOKIE)
    }

    return NextResponse.json(
      {
        success: true,
        data: result.data,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Login API error:', error)

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid input data' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
