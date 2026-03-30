import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { z } from 'zod';
import { getContainer } from '@/infrastructure/di';
import { ResponseBuilder } from '@/core/utils/api/ApiResponse';
import { NotFoundError } from '@/core/utils/errors';
import { calculateNextDueDate } from '@/core/utils/date';

// ============================================================
// POST /api/members/[id]/payment/preview - Preview payment calculation
// ============================================================

const previewSchema = z.object({
  paymentDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  deductOverduePeriod: z.boolean().default(true),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gymProfile = await getCurrentGymProfile();
    const body = await request.json();

    // Validate input
    const validatedData = previewSchema.parse(body);

    // Get member
    const container = await getContainer();
    const memberRepo = container.getMemberRepository();
    const member = await memberRepo.findById(id, gymProfile.id);

    if (!member) {
      return NextResponse.json(
        ResponseBuilder.notFound('Member not found'),
        { status: 404 }
      );
    }

    // Calculate next due date using centralized utility
    const paymentDate = new Date(validatedData.paymentDate);
    const baseDate = validatedData.deductOverduePeriod
      ? paymentDate
      : member.nextDueDate;

    const nextDueDate = calculateNextDueDate(baseDate, member.planType, {
      deductOverduePeriod: validatedData.deductOverduePeriod,
    });

    return NextResponse.json(
      ResponseBuilder.success({
        nextDueDate: nextDueDate.toISOString(),
        nextDueDateFormatted: nextDueDate.toLocaleDateString('en-GB'),
        planType: member.planType,
        currentDueDate: member.nextDueDate.toISOString(),
        deductOverduePeriod: validatedData.deductOverduePeriod,
      })
    );
  } catch (error) {
    console.error('Payment preview API error:', error);

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        ResponseBuilder.notFound(error.message),
        { status: 404 }
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
      ResponseBuilder.error('Failed to preview payment', 'PREVIEW_ERROR'),
      { status: 500 }
    );
  }
}
