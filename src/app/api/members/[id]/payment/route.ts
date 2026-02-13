import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { collectPaymentSchema } from '@/features/members/schemas/member.schemas';
import { collectPayment } from '@/features/members/services/payment.service';

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

    // Collect payment
    const result = await collectPayment(gymProfile.id, validatedData);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Collect payment API error:', error);

    if (error instanceof Error && error.message === 'Member not found') {
      return NextResponse.json(
        { success: false, error: 'Member not found' },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid input data' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to collect payment' },
      { status: 500 }
    );
  }
}
