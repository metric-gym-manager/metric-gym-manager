import { NextRequest, NextResponse } from 'next/server'
import {
  getPlanById,
  updatePlan,
  deactivatePlan,
} from '@/features/memberships/services/plans.service'
import { UpdatePlanSchema } from '@/features/memberships/schemas/memberships.schemas'
import { authenticate, requireRole } from '@/lib/middleware/auth'
import { validateBody } from '@/lib/middleware/validation'
import { handleError } from '@/lib/middleware/error-handler'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticate(request)
    const plan = await getPlanById(params.id, user.userId)

    if (!plan) {
      return NextResponse.json(
        {
          success: false,
          error: 'Plan not found',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: plan,
    })
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticate(request)
    await requireRole(['gym_owner', 'admin'])(user)

    const input = await validateBody(request, UpdatePlanSchema)
    const plan = await updatePlan(params.id, user.userId, input)

    return NextResponse.json({
      success: true,
      data: plan,
    })
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticate(request)
    await requireRole(['gym_owner', 'admin'])(user)

    const plan = await deactivatePlan(params.id, user.userId)

    return NextResponse.json({
      success: true,
      data: plan,
      message: 'Plan deactivated successfully',
    })
  } catch (error) {
    return handleError(error)
  }
}
