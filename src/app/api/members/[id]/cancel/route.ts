import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { getContainer } from '@/infrastructure/di';
import { ResponseBuilder } from '@/core/utils/api/ApiResponse';
import { NotFoundError, InvalidStatusTransitionError } from '@/core/utils/errors';

// ============================================================
// POST /api/members/[id]/cancel - Cancel member
// ============================================================

/**
 * Cancel Member Endpoint
 *
 * Permanently cancels a member's membership (terminal state).
 *
 * Valid transitions enforced by state machine:
 * - Expired → Cancelled (45+ days overdue)
 * - Suspended → Cancelled (permanent ban)
 *
 * Note: Cancelled is a terminal state with no outgoing transitions.
 *
 * @throws InvalidStatusTransitionError if transition not allowed
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gymProfile = await getCurrentGymProfile();

    // Execute cancel via use case
    const container = await getContainer();
    const cancelMember = container.getCancelMemberUseCase();

    const cancelledMember = await cancelMember.execute({
      memberId: id,
      gymId: gymProfile.id,
    });

    return NextResponse.json(
      ResponseBuilder.success(
        cancelledMember.toDatabase(),
        { message: 'Member cancelled successfully' }
      ),
      { status: 200 }
    );
  } catch (error) {
    console.error('Cancel member API error:', error);

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        ResponseBuilder.notFound(error.message),
        { status: 404 }
      );
    }

    if (error instanceof InvalidStatusTransitionError) {
      return NextResponse.json(
        ResponseBuilder.validationError({
          general: [error.message]
        }),
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        ResponseBuilder.unauthorized(),
        { status: 401 }
      );
    }

    return NextResponse.json(
      ResponseBuilder.error('Failed to cancel member', 'CANCEL_ERROR'),
      { status: 500 }
    );
  }
}
