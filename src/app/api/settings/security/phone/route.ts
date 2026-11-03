import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentGymProfile } from '@/lib/middleware/auth'
import { updateGymPhone } from '@/features/settings/services/settings.service'
import { updateGymPhoneSchema } from '@/features/settings/schemas/settings.schemas'
import { ResponseBuilder } from '@/utils/api/ApiResponse'

// ============================================================
// POST /api/settings/security/phone - Update the owner's phone number
// ============================================================

/**
 * Saves the signed-in owner's phone number on their own gym. The session is
 * the proof of ownership; there is no one-time code.
 */
export async function POST(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile()
    const body = await request.json()

    const { phone_number } = updateGymPhoneSchema.parse(body)

    const result = await updateGymPhone(gymProfile.id, phone_number)

    if (result.status === 'taken') {
      return NextResponse.json(
        ResponseBuilder.conflict(
          'This phone number is already used by another gym account.'
        ),
        { status: 409 }
      )
    }

    if (result.status === 'error') {
      return NextResponse.json(
        ResponseBuilder.error(
          'Failed to update phone number',
          'PHONE_UPDATE_ERROR'
        ),
        { status: 500 }
      )
    }

    return NextResponse.json(
      ResponseBuilder.success(
        { phone_number: result.profile.phone_number },
        { message: 'Phone number updated successfully' }
      ),
      { status: 200 }
    )
  } catch (error) {
    console.error('Update phone number API error:', error)

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 })
    }

    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string[]> = {}
      for (const issue of error.issues) {
        const field = issue.path.join('.') || 'general'
        fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message]
      }
      return NextResponse.json(ResponseBuilder.validationError(fieldErrors), {
        status: 400,
      })
    }

    return NextResponse.json(
      ResponseBuilder.error(
        'Failed to update phone number',
        'PHONE_UPDATE_ERROR'
      ),
      { status: 500 }
    )
  }
}
