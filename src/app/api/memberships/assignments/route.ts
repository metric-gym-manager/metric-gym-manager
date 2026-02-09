import { NextRequest, NextResponse } from 'next/server'
import {
  assignPlanToMember,
  getMemberActiveMembership,
  getMemberMembershipHistory,
} from '@/features/memberships/services/assignments.service'
import { AssignPlanSchema } from '@/features/memberships/schemas/memberships.schemas'
import { authenticate, requireRole } from '@/lib/middleware/auth'
import { validateBody } from '@/lib/middleware/validation'
import { handleError } from '@/lib/middleware/error-handler'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request)
    await requireRole(['gym_owner', 'admin', 'front_desk'])(user)

    const input = await validateBody(request, AssignPlanSchema)
    const membership = await assignPlanToMember(user.userId, input)

    return NextResponse.json(
      {
        success: true,
        data: membership,
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
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json(
        {
          success: false,
          error: 'memberId query parameter is required',
        },
        { status: 400 }
      )
    }

    const history = await getMemberMembershipHistory(memberId, user.userId)

    return NextResponse.json({
      success: true,
      data: history,
    })
  } catch (error) {
    return handleError(error)
  }
}
