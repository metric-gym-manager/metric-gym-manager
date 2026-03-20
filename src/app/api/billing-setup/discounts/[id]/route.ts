import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { updateDiscountSchema } from '@/features/settings/schemas/settings.schemas';
import { updateDiscount, deleteDiscount } from '@/features/settings/services/settings.service';

// ============================================================
// PATCH /api/billing-setup/discounts/[id] - Update discount
// ============================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gymProfile = await getCurrentGymProfile();
    const body = await request.json();

    // Validate input
    const validatedData = updateDiscountSchema.parse(body);

    // Update discount
    const discount = await updateDiscount(id, gymProfile.id, validatedData);

    return NextResponse.json(
      {
        success: true,
        data: discount,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update discount API error:', error);

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
      { success: false, error: 'Failed to update discount' },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE /api/billing-setup/discounts/[id] - Delete discount
// ============================================================

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gymProfile = await getCurrentGymProfile();

    await deleteDiscount(id, gymProfile.id);

    return NextResponse.json(
      {
        success: true,
        message: 'Discount deleted successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Delete discount API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (
      error instanceof Error &&
      error.message.includes('Cannot delete discount: it is currently assigned')
    ) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to delete discount' },
      { status: 500 }
    );
  }
}
