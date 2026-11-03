import { NextRequest, NextResponse } from 'next/server'
import { getCurrentGymProfile } from '@/lib/middleware/auth'
import { createClient } from '@/lib/supabase/server'
import { createSuspendMember } from '@/features/members'
import { serializeMemberForAPI } from '@/features/members/utils/serializeMemberForAPI'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import {
  ConflictError,
  NotFoundError,
  InvalidStatusTransitionError,
} from '@/utils/errors'

// ============================================================
// POST /api/members/[id]/suspend - Suspend member
// ============================================================

/**
 * Suspend Member Endpoint
 *
 * Transitions a member to suspended status (policy violation or voluntary hold).
 *
 * Valid transitions enforced by state machine:
 * - Active → Suspended
 *
 * @throws InvalidStatusTransitionError if transition not allowed
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const gymProfile = await getCurrentGymProfile()

    // Execute suspend via use case
    const suspendMember = createSuspendMember(await createClient())

    const suspendedMember = await suspendMember.execute({
      memberId: id,
      gymId: gymProfile.id,
    })

    return NextResponse.json(
      ResponseBuilder.success(serializeMemberForAPI(suspendedMember), {
        message: 'Member suspended successfully',
      }),
      { status: 200 }
    )
  } catch (error) {
    console.error('Suspend member API error:', error)

    if (error instanceof NotFoundError) {
      return NextResponse.json(ResponseBuilder.notFound(error.message), {
        status: 404,
      })
    }

    // The member changed after this request read it (the expiry cron, a
    // payment on another device). 409 with the reason, not a 500.
    if (error instanceof ConflictError) {
      return NextResponse.json(ResponseBuilder.conflict(error.message), {
        status: 409,
      })
    }

    if (error instanceof InvalidStatusTransitionError) {
      return NextResponse.json(
        ResponseBuilder.validationError({
          general: [error.message],
        }),
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 })
    }

    return NextResponse.json(
      ResponseBuilder.error('Failed to suspend member', 'SUSPEND_ERROR'),
      { status: 500 }
    )
  }
}
