import { NextRequest, NextResponse } from 'next/server'
import {
  getMemberById,
  updateMember,
  updateMemberStatus,
} from '@/features/members/services/members.service'
import {
  UpdateMemberSchema,
  UpdateMemberStatusSchema,
} from '@/features/members/schemas/members.schemas'
import { authenticate, requireRole } from '@/lib/middleware/auth'
import { validateBody } from '@/lib/middleware/validation'
import { handleError } from '@/lib/middleware/error-handler'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticate(request)
    const member = await getMemberById(params.id, user.userId)

    if (!member) {
      return NextResponse.json(
        {
          success: false,
          error: 'Member not found',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: member,
    })
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticate(request)
    await requireRole(['gym_owner', 'admin', 'front_desk'])(user)

    // Check if this is a status update
    const body = await request.json()
    if (body.status && Object.keys(body).length === 1) {
      const { status } = UpdateMemberStatusSchema.parse(body)
      const member = await updateMemberStatus(params.id, user.userId, status)

      return NextResponse.json({
        success: true,
        data: member,
      })
    }

    // Regular update
    const input = UpdateMemberSchema.parse(body)
    const member = await updateMember(params.id, user.userId, input)

    return NextResponse.json({
      success: true,
      data: member,
    })
  } catch (error) {
    return handleError(error)
  }
}
