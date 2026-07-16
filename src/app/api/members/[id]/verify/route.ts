import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { getContainer } from '@/infrastructure/di';
import { ResponseBuilder } from '@/utils/api/ApiResponse';
import { NotFoundError } from '@/utils/errors';

// ============================================================
// POST /api/members/[id]/verify - Verify a QR self-registration
// ============================================================

/**
 * Verify Member Endpoint
 *
 * Marks a QR self-registered member as verified (clears the NEW badge).
 * Idempotent: verifying an already-verified or manual member is a no-op.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gymProfile = await getCurrentGymProfile();

    const container = await getContainer();
    const verifyMember = container.getVerifyMemberUseCase();

    const verifiedMember = await verifyMember.execute({
      memberId: id,
      gymId: gymProfile.id,
    });

    return NextResponse.json(
      ResponseBuilder.success(
        {
          id: verifiedMember.id,
          registrationSource: verifiedMember.registrationSource,
          verifiedAt: verifiedMember.verifiedAt?.toISOString() ?? null,
        },
        { message: 'Member verified successfully' }
      )
    );
  } catch (error) {
    console.error('Verify member API error:', error);

    if (error instanceof NotFoundError) {
      return NextResponse.json(ResponseBuilder.notFound('Member'), {
        status: 404,
      });
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 });
    }

    return NextResponse.json(
      ResponseBuilder.error('Failed to verify member', 'VERIFY_ERROR'),
      { status: 500 }
    );
  }
}
