import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { collectPaymentSchema } from '@/features/members/schemas/member.schemas';
import { createClient } from '@/lib/supabase/server';
import { createCollectPayment } from '@/features/payments';
import { ResponseBuilder } from '@/utils/api/ApiResponse';
import { NotFoundError, ValidationError, InvalidStatusTransitionError, MemberLimitError } from '@/utils/errors';

// ============================================================
// POST /api/members/[id]/payment - Collect payment
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gymProfile = await getCurrentGymProfile();
    const body = await request.json();

    // Validate input
    const validatedData = collectPaymentSchema.parse({
      ...body,
      memberId: id,
    });

    // Get discount info if applicable
    let discount = null;
    if (validatedData.discountId) {
      const supabase = (await import('@/lib/supabase/server')).createClient();
      const { data: discountData } = await (await supabase)
        .from('discounts')
        .select('id, discount_name, discount_percentage')
        .eq('id', validatedData.discountId)
        .single();

      if (discountData) {
        discount = {
          discountId: discountData.id,
          discountName: discountData.discount_name,
          discountPercentage: discountData.discount_percentage,
        };
      }
    }

    // Collect payment via use case
    const collectPayment = createCollectPayment(await createClient());

    const result = await collectPayment.execute({
      gymId: gymProfile.id,
      memberId: id,
      paymentDate: new Date(validatedData.paymentDate),
      paymentAmount: validatedData.paymentAmount,
      discountId: validatedData.discountId || null,
      discount,
      deductOverduePeriod: validatedData.deductOverduePeriod ?? true,
    });

    // Convert domain entities to database format for API response
    const memberData = result.member.toDatabase();
    const paymentData = result.payment.toDatabase();

    return NextResponse.json(
      ResponseBuilder.success(
        {
          member: memberData,
          payment: paymentData,
        },
        { message: 'Payment collected successfully' }
      ),
      { status: 201 }
    );
  } catch (error) {
    console.error('Collect payment API error:', error);

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        ResponseBuilder.notFound(error.message),
        { status: 404 }
      );
    }

    if (error instanceof ValidationError) {
      return NextResponse.json(
        ResponseBuilder.validationError({ general: [error.message] }),
        { status: 400 }
      );
    }

    if (error instanceof InvalidStatusTransitionError) {
      return NextResponse.json(
        ResponseBuilder.error(error.message, 'INVALID_STATUS_TRANSITION'),
        { status: 400 }
      );
    }

    if (error instanceof MemberLimitError) {
      // Collecting payment from an expired/suspended member reactivates them;
      // at the active-member cap the DB trigger blocks that flip BEFORE the
      // payment is recorded (CollectPayment flips first by design), so this
      // 403 means: nothing was written — upgrade to reactivate.
      return NextResponse.json(
        ResponseBuilder.error(error.message, 'MEMBER_LIMIT_REACHED'),
        { status: 403 }
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
      ResponseBuilder.error('Failed to collect payment', 'PAYMENT_ERROR'),
      { status: 500 }
    );
  }
}
