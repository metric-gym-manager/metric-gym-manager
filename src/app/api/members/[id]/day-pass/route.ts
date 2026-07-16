import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { getContainer } from '@/infrastructure/di';
import { ResponseBuilder } from '@/utils/api/ApiResponse';
import {
  BusinessRuleViolationError,
  InvalidStatusTransitionError,
  NotFoundError,
  ValidationError,
} from '@/utils/errors';

// ============================================================
// POST /api/members/[id]/day-pass - Issue a day pass
// ============================================================

const dayPassSchema = z.object({
  amount: z
    .number()
    .positive('Amount must be greater than 0')
    .max(1000000, 'Amount is too large'),

  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
});

/**
 * Day Pass Endpoint
 *
 * Records a single-day access fee for a member whose membership period has
 * ended (expired, or overdue-active within the pre-cron grace window).
 * Sets next_due_date to tomorrow without changing plan_type; revenue lands
 * in payments as payment_type='day_pass'. Receipt SMS is sent and logged.
 *
 * Rejected (400) when the member is still within their membership period,
 * or is suspended/cancelled.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gymProfile = await getCurrentGymProfile();
    const body = await request.json();

    const validated = dayPassSchema.parse(body);

    const container = await getContainer();
    const issueDayPass = container.getIssueDayPassUseCase();

    const result = await issueDayPass.execute({
      gymId: gymProfile.id,
      memberId: id,
      amount: validated.amount,
      paymentDate: validated.paymentDate
        ? new Date(validated.paymentDate)
        : undefined,
    });

    return NextResponse.json(
      ResponseBuilder.success(
        {
          memberId: result.member.id,
          status: result.member.status,
          nextDueDate: result.member.nextDueDate.toISOString().split('T')[0],
          amountPaid: result.payment.amountPaid,
          paymentType: result.payment.paymentType,
        },
        { message: 'Day pass issued successfully' }
      ),
      { status: 201 }
    );
  } catch (error) {
    console.error('Issue day pass API error:', error);

    if (error instanceof NotFoundError) {
      return NextResponse.json(ResponseBuilder.notFound('Member'), {
        status: 404,
      });
    }

    if (
      error instanceof BusinessRuleViolationError ||
      error instanceof ValidationError ||
      error instanceof InvalidStatusTransitionError
    ) {
      return NextResponse.json(
        ResponseBuilder.validationError({ general: [error.message] }),
        { status: 400 }
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        ResponseBuilder.validationError({ general: ['Invalid input data'] }),
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 });
    }

    return NextResponse.json(
      ResponseBuilder.error('Failed to issue day pass', 'DAY_PASS_ERROR'),
      { status: 500 }
    );
  }
}
