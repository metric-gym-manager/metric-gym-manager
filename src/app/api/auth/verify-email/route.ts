import { NextRequest, NextResponse } from 'next/server'
import { verifyEmailChange } from '@/features/auth/services/email-confirmation.service'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Verification token is required' },
        { status: 400 }
      )
    }

    const result = await verifyEmailChange(token)

    if (result.status === 'invalid') {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired verification link' },
        { status: 400 }
      )
    }

    if (result.status === 'no_user') {
      return NextResponse.json(
        { success: false, error: 'Failed to verify email' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
    })
  } catch (error) {
    console.error('Unexpected error in email verification:', error)
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
