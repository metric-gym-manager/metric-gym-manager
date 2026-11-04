import { NextRequest, NextResponse } from 'next/server'
import { resetPasswordSchema } from '@/features/auth/schemas/auth.schemas'
import { resetPassword } from '@/features/auth/services/auth.service'
import { rejectCrossSiteRequest } from '@/lib/middleware/sameOrigin'

export async function POST(request: NextRequest) {
  // Another site must not be able to set a password from this browser.
  const crossSite = rejectCrossSiteRequest(request)
  if (crossSite) return crossSite

  try {
    const body = await request.json()

    // Validate input
    const validatedData = resetPasswordSchema.parse(body)

    // Reset password. The one-time token is spent here, on an explicit POST —
    // never on a GET, which an email scanner can issue before the user clicks.
    const result = await resetPassword(
      validatedData.token_hash,
      validatedData.password
    )

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Password reset successfully',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Reset password API error:', error)

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
