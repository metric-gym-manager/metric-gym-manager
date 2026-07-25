import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentGymProfile } from '@/lib/middleware/auth'
import { updateGymPoliciesSchema } from '@/features/settings/schemas/settings.schemas'
import {
  getGymPolicies,
  updateGymPolicies,
} from '@/features/settings/services/settings.service'
import { ResponseBuilder } from '@/utils/api/ApiResponse'

// ============================================================
// GET /api/settings/policies - Get gym rules & terms of service
// ============================================================

export async function GET(_request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile()

    const policies = await getGymPolicies(gymProfile.id)

    return NextResponse.json(ResponseBuilder.success(policies), { status: 200 })
  } catch (error) {
    console.error('Get gym policies API error:', error)

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 })
    }

    return NextResponse.json(
      ResponseBuilder.error('Failed to fetch gym policies', 'FETCH_ERROR'),
      { status: 500 }
    )
  }
}

// ============================================================
// PATCH /api/settings/policies - Update gym rules & terms of service
// ============================================================

export async function PATCH(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile()
    const body = await request.json()

    const validatedData = updateGymPoliciesSchema.parse(body)

    const policies = await updateGymPolicies(gymProfile.id, validatedData)

    return NextResponse.json(ResponseBuilder.success(policies), { status: 200 })
  } catch (error) {
    console.error('Update gym policies API error:', error)

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
      ResponseBuilder.error('Failed to update gym policies', 'UPDATE_ERROR'),
      { status: 500 }
    )
  }
}
