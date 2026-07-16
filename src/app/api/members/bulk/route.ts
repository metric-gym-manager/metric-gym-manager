import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { addMemberSchema } from '@/features/members/schemas/member.schemas';
import { getAdminContainer } from '@/infrastructure/di';
import { ResponseBuilder } from '@/utils/api/ApiResponse';
import { MemberLimitError } from '@/utils/errors';
import { PlanType } from '@/features/members/config/PlanConfig';
import { z } from 'zod';

const bulkCreateSchema = z.object({
  members: z.array(addMemberSchema).min(1).max(50),
});

interface BulkResult {
  index: number;
  success: boolean;
  name: string;
  memberId?: string;
  error?: string;
  /** Machine-readable code (e.g. MEMBER_LIMIT_REACHED) for the upgrade prompt */
  errorCode?: string;
}

// POST /api/members/bulk
export async function POST(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();
    const body = await request.json();

    let validated: z.infer<typeof bulkCreateSchema>;
    try {
      validated = bulkCreateSchema.parse(body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          ResponseBuilder.badRequest('Invalid input data', { errors: err.errors }),
          { status: 400 }
        );
      }
      throw err;
    }

    // Admin container on purpose: each row goes through the guarded quota RPC
    // (service_role-only EXECUTE); the caller's gym id was pinned above (plan C-15).
    // The per-gym row lock serializes the parallel inserts correctly.
    const container = await getAdminContainer();
    const registerMember = container.getRegisterMemberUseCase();

    // Process all members in parallel
    const results: BulkResult[] = await Promise.allSettled(
      validated.members.map(async (memberInput, index) => {
        const result = await registerMember.execute({
          gymId: gymProfile.id,
          name: memberInput.name,
          phoneNumber: memberInput.phoneNumber,
          planType: memberInput.planType as PlanType,
          planAmount: memberInput.planAmount,
          discountId: memberInput.discountId || null,
          recurringDiscount: memberInput.recurringDiscount ?? false,
          membershipStartDate: new Date(memberInput.membershipStartDate),
          paymentAmount: memberInput.paymentAmount,
        });

        // Welcome SMS is sent automatically by the use case
        return { index, success: true, name: memberInput.name, memberId: result.member.id };
      })
    ).then((settled) =>
      settled.map((result, index) => {
        if (result.status === 'fulfilled') return result.value;
        return {
          index,
          success: false,
          name: validated.members[index].name,
          error:
            result.reason instanceof Error ? result.reason.message : 'Failed to create',
          errorCode:
            result.reason instanceof MemberLimitError ? 'MEMBER_LIMIT_REACHED' : undefined,
        };
      })
    );

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return NextResponse.json(
      ResponseBuilder.success({
        results,
        summary: {
          total: results.length,
          succeeded: successCount,
          failed: failureCount,
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Bulk create members API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        ResponseBuilder.unauthorized(),
        { status: 401 }
      );
    }

    return NextResponse.json(
      ResponseBuilder.internalError(
        'Failed to process bulk registration',
        error instanceof Error ? error.stack : undefined
      ),
      { status: 500 }
    );
  }
}
