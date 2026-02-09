import { NextRequest, NextResponse } from 'next/server'
import { createPlan, listPlans } from '@/features/memberships/services/plans.service'
import { CreatePlanSchema } from '@/features/memberships/schemas/memberships.schemas'
import { authenticate, requireRole } from '@/lib/middleware/auth'
import { validateBody } from '@/lib/middleware/validation'
import { handleError } from '@/lib/middleware/error-handler'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request)
    await requireRole(['gym_owner', 'admin'])(user)

    const input = await validateBody(request, CreatePlanSchema)
    const plan = await createPlan(user.gymId, user.userId, input)

    return NextResponse.json(
      {
        success: true,
        data: plan,
      },
      { status: 201 }
    )
  } catch (error) {
    return handleError(error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request)

    const { searchParams } = new URL(request.url)
    const planType = searchParams.get('planType') || undefined
    const isActive = searchParams.get('isActive')
      ? searchParams.get('isActive') === 'true'
      : undefined

    const plans = await listPlans(user.gymId, user.userId, {
      planType,
      isActive,
    })

    return NextResponse.json({
      success: true,
      data: plans,
    })
  } catch (error) {
    return handleError(error)
  }
}
