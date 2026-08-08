import { NextRequest, NextResponse } from 'next/server'
import { getCurrentGymProfile } from '@/lib/middleware/auth'
import {
  createPlanTypeSchema,
  updatePlanTypeSchema,
  deletePlanTypeSchema,
} from '@/features/settings/schemas/settings.schemas'
import {
  getPlanTypes,
  createPlanType,
  updatePlanType,
  deletePlanType,
} from '@/features/settings/services/settings.service'

// ============================================================
// GET /api/settings/plans - Get plan types
// ============================================================

export async function GET(_request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile()

    const planTypes = await getPlanTypes(gymProfile.id)

    return NextResponse.json(
      {
        success: true,
        data: planTypes,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    )
  } catch (error) {
    console.error('Get plan types API error:', error)

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch plan types' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST /api/settings/plans - Create new plan type
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile()
    const body = await request.json()

    // Validate input
    const validatedData = createPlanTypeSchema.parse(body)

    // Create plan type
    const planType = await createPlanType(gymProfile.id, validatedData)

    return NextResponse.json(
      {
        success: true,
        data: planType,
        message: 'Plan type created successfully',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create plan type API error:', error)

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json(
        { success: false, error: 'Plan type already exists' },
        { status: 409 }
      )
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid input data' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create plan type' },
      { status: 500 }
    )
  }
}

// ============================================================
// PATCH /api/settings/plans - Update plan type
// ============================================================

export async function PATCH(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile()
    const body = await request.json()

    // Validate input
    const validatedData = updatePlanTypeSchema.parse(body)

    // Update plan type
    const planType = await updatePlanType(gymProfile.id, validatedData)

    return NextResponse.json(
      {
        success: true,
        data: planType,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Update plan type API error:', error)

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid input data' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update plan type' },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/settings/plans - Delete plan type
// ============================================================

export async function DELETE(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile()
    const body = await request.json()

    // Validate input
    const validatedData = deletePlanTypeSchema.parse(body)

    // Delete plan type
    await deletePlanType(gymProfile.id, validatedData.plan_type)

    return NextResponse.json(
      {
        success: true,
        message: 'Plan type deleted successfully',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Delete plan type API error:', error)

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (error instanceof Error && error.message.includes('in use')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete plan type that is in use by members',
        },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid input data' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to delete plan type' },
      { status: 500 }
    )
  }
}
