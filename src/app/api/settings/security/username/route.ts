import { NextRequest, NextResponse } from 'next/server'
import { getCurrentGymProfile } from '@/lib/middleware/auth'
import { updateGymUsername } from '@/features/settings/services/settings.service'
import { z } from 'zod'

// ============================================================
// POST /api/settings/security/username - Update username
// ============================================================

const updateUsernameSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must not exceed 50 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, hyphens, and underscores'
    ),
})

export async function POST(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile()
    const body = await request.json()

    // Validate request body
    const validatedData = updateUsernameSchema.parse(body)

    const result = await updateGymUsername(
      gymProfile.id,
      validatedData.username
    )

    if (result.status === 'taken') {
      return NextResponse.json(
        { success: false, error: 'Username is already taken' },
        { status: 400 }
      )
    }

    if (result.status === 'error') {
      return NextResponse.json(
        { success: false, error: 'Failed to update username' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Username updated successfully',
        data: result.profile,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Update username API error:', error)

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update username' },
      { status: 500 }
    )
  }
}
