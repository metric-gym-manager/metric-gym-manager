import { NextRequest, NextResponse } from 'next/server'
import { updateEmail } from '@/features/auth/services/auth.service'
import { updateEmailSchema } from '@/features/settings/schemas/settings.schemas'

// ============================================================
// POST /api/settings/security/email - Update email address
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validatedData = updateEmailSchema.parse(body)

    // Call service function
    const result = await updateEmail(validatedData.email)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        // Asserts a REQUEST, not a delivery — see `updateEmail`.
        message:
          result.data?.message ||
          'Change requested. Confirmation links are on their way to both addresses.',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Update email API error:', error)

    // Handle Zod validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update email' },
      { status: 500 }
    )
  }
}
