import { NextRequest, NextResponse } from 'next/server'
import { forgotPasswordSchema } from '@/features/auth/schemas/auth.schemas'
import { sendPasswordResetEmail } from '@/features/auth/services/auth.service'
import { rejectCrossSiteRequest } from '@/lib/middleware/sameOrigin'

export async function POST(request: NextRequest) {
  // Another site must not be able to send reset emails from this browser.
  const crossSite = rejectCrossSiteRequest(request)
  if (crossSite) return crossSite

  try {
    const body = await request.json()

    // Validate input
    const validatedData = forgotPasswordSchema.parse(body)

    // Send password reset email
    const result = await sendPasswordResetEmail(validatedData.email)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Password reset instructions sent to your email',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Forgot password API error:', error)

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
