import { NextRequest, NextResponse } from 'next/server'
import { createMember, listMembers } from '@/features/members/services/members.service'
import { CreateMemberSchema } from '@/features/members/schemas/members.schemas'
import { authenticate, requireRole } from '@/lib/middleware/auth'
import { validateBody } from '@/lib/middleware/validation'
import { handleError } from '@/lib/middleware/error-handler'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request)
    await requireRole(['gym_owner', 'admin', 'front_desk'])(user)

    const input = await validateBody(request, CreateMemberSchema)
    const member = await createMember(user.gymId, user.userId, input)

    return NextResponse.json(
      {
        success: true,
        data: member,
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
    const status = searchParams.get('status') as any
    const search = searchParams.get('search') || undefined
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0

    const result = await listMembers(user.gymId, {
      status,
      search,
      limit,
      offset,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return handleError(error)
  }
}
