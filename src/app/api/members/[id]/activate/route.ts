import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { getContainer } from '@/infrastructure/di';
import { ResponseBuilder } from '@/utils/api/ApiResponse';
import { NotFoundError, InvalidStatusTransitionError, MemberLimitError } from '@/utils/errors';
import { z } from 'zod';

// ============================================================
// POST /api/members/[id]/activate - Activate/Reactivate member
// ============================================================

/**
 * Validation schema for activate request
 */
const activateMemberSchema = z.object({
  newDueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});

/**
 * Activate Member Endpoint
 *
 * Transitions a member to active status (from expired or suspended).
 *
 * Valid transitions enforced by state machine:
 * - Expired → Active
 * - Suspended → Active
 *
 * @throws InvalidStatusTransitionError if transition not allowed
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gymProfile = await getCurrentGymProfile();
    const body = await request.json();

    // Validate input
    const validatedData = activateMemberSchema.parse(body);

    // Execute activate via use case
    const container = await getContainer();
    const reactivateMember = container.getReactivateMemberUseCase();

    const activatedMember = await reactivateMember.execute({
      memberId: id,
      gymId: gymProfile.id,
      newDueDate: new Date(validatedData.newDueDate),
    });

    return NextResponse.json(
      ResponseBuilder.success(
        activatedMember.toDatabase(),
        { message: 'Member activated successfully' }
      ),
      { status: 200 }
    );
  } catch (error) {
    console.error('Activate member API error:', error);

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        ResponseBuilder.notFound(error.message),
        { status: 404 }
      );
    }

    if (error instanceof MemberLimitError) {
      // Active-member quota exhausted (DB trigger) — the frontend keys the
      // upgrade pop-up on this machine-readable code
      return NextResponse.json(
        ResponseBuilder.error(error.message, 'MEMBER_LIMIT_REACHED'),
        { status: 403 }
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

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        ResponseBuilder.validationError({ general: ['Invalid input data'] }),
        { status: 400 }
      );
    }

    return NextResponse.json(
      ResponseBuilder.error('Failed to activate member', 'ACTIVATE_ERROR'),
      { status: 500 }
    );
  }
}
