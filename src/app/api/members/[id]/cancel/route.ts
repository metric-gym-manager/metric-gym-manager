import { NextRequest, NextResponse } from 'next/server'
import { getCurrentGymProfile } from '@/lib/middleware/auth'
import { createClient } from '@/lib/supabase/server'
import { createCancelMember } from '@/features/members'
import { serializeMemberForAPI } from '@/features/members/utils/serializeMemberForAPI'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { NotFoundError, InvalidStatusTransitionError } from '@/utils/errors'

// ============================================================
// POST /api/members/[id]/cancel - Cancel member
// ============================================================

/**
 * Cancel Member Endpoint
 *
 * Cancels a member's membership.
 *
 * Valid transitions enforced by state machine:
 * - Expired → Cancelled (14+ days overdue)
 * - Suspended → Cancelled (permanent ban)
 *
 * Note: a cancelled member can later be brought back via the reactivation
 * payment flow (Cancelled → Active), so this is not a terminal state.
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

    // Execute cancel via use case
    const cancelMember = createCancelMember(await createClient())

    const cancelledMember = await cancelMember.execute({
      memberId: id,
      gymId: gymProfile.id,
    })

    return NextResponse.json(
      ResponseBuilder.success(serializeMemberForAPI(cancelledMember), {
        message: 'Member cancelled successfully',
      }),
      { status: 200 }
    )
  } catch (error) {
    console.error('Cancel member API error:', error)

    if (error instanceof NotFoundError) {
      return NextResponse.json(ResponseBuilder.notFound(error.message), {
        status: 404,
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
      ResponseBuilder.error('Failed to cancel member', 'CANCEL_ERROR'),
      { status: 500 }
    )
  }
}
