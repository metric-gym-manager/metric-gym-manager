import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentGymProfile } from '@/lib/middleware/auth'
import { updateAdmissionFeeSchema } from '@/features/settings/schemas/settings.schemas'
import {
  getAdmissionFee,
  updateAdmissionFee,
} from '@/features/settings/services/settings.service'
import { ResponseBuilder } from '@/utils/api/ApiResponse'

// ============================================================
// GET /api/billing-setup/admission-fee - Get admission fee config
// ============================================================

export async function GET(_request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile()

    const admissionFee = await getAdmissionFee(gymProfile.id)

    return NextResponse.json(ResponseBuilder.success(admissionFee), {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('Get admission fee API error:', error)

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 })
    }

    return NextResponse.json(
      ResponseBuilder.error('Failed to fetch admission fee', 'FETCH_ERROR'),
      { status: 500 }
    )
  }
}

// ============================================================
// PATCH /api/billing-setup/admission-fee - Update admission fee config
// ============================================================

export async function PATCH(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile()
    const body = await request.json()

    const validatedData = updateAdmissionFeeSchema.parse(body)

    const admissionFee = await updateAdmissionFee(gymProfile.id, validatedData)

    return NextResponse.json(ResponseBuilder.success(admissionFee), {
      status: 200,
    })
  } catch (error) {
    console.error('Update admission fee API error:', error)

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
      ResponseBuilder.error('Failed to update admission fee', 'UPDATE_ERROR'),
      { status: 500 }
    )
  }
}
