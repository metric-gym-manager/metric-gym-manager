import { NextRequest, NextResponse } from 'next/server';
import { getApiGymProfile } from '@/lib/middleware/api-auth';
import { updateMemberSchema } from '@/features/members/schemas/member.schemas';
import { getContainer } from '@/infrastructure/di';
import { ResponseBuilder } from '@/core/utils/api/ApiResponse';
import { NotFoundError } from '@/core/utils/errors';
import { PlanType } from '@/core/utils/constants/PlanConfig';

// ============================================================
// GET /api/members/[id] - Get member by ID
// ============================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { gymProfile, error: authError } = await getApiGymProfile();

    if (authError) {
      return authError;
    }

    // Use repository to get member
    const container = await getContainer();
    const memberRepo = container.getMemberRepository();
    const member = await memberRepo.findById(id, gymProfile!.id);

    if (!member) {
      return NextResponse.json(
        ResponseBuilder.notFound('Member not found'),
        { status: 404 }
      );
    }

    return NextResponse.json(
      ResponseBuilder.success(member.toDatabase()),
      { status: 200 }
    );
  } catch (error) {
    console.error('Get member API error:', error);

    return NextResponse.json(
      ResponseBuilder.error('Failed to fetch member', 'FETCH_ERROR'),
      { status: 500 }
    );
  }
}

// ============================================================
// PATCH /api/members/[id] - Update member
// ============================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { gymProfile, error: authError } = await getApiGymProfile();

    if (authError) {
      return authError;
    }

    const body = await request.json();

    // Validate input
    const validatedData = updateMemberSchema.parse(body);

    // Get member and update via repository
    const container = await getContainer();
    const memberRepo = container.getMemberRepository();
    const member = await memberRepo.findById(id, gymProfile!.id);

    if (!member) {
      return NextResponse.json(
        ResponseBuilder.notFound('Member not found'),
        { status: 404 }
      );
    }

    // Apply updates to member entity
    // NOTE: Status transitions must use dedicated endpoints:
    // POST /api/members/[id]/suspend
    // POST /api/members/[id]/activate
    // POST /api/members/[id]/cancel
    let updatedMember = member;
    if (validatedData.name) {
      updatedMember = updatedMember.updateName(validatedData.name);
    }
    if (validatedData.phoneNumber) {
      updatedMember = updatedMember.updatePhoneNumber(validatedData.phoneNumber);
    }
    if (validatedData.planType) {
      updatedMember = updatedMember.updatePlanType(validatedData.planType as PlanType);
    }
    if (validatedData.planAmount !== undefined) {
      updatedMember = updatedMember.updatePlanAmount(validatedData.planAmount);
    }
    if (validatedData.recurringDiscount !== undefined) {
      updatedMember = updatedMember.updateRecurringDiscount(validatedData.recurringDiscount);
    }
    if (validatedData.discountId !== undefined) {
      updatedMember = updatedMember.updateDiscountId(validatedData.discountId);
    }

    const saved = await memberRepo.update(updatedMember);

    return NextResponse.json(
      ResponseBuilder.success(saved.toDatabase()),
      { status: 200 }
    );
  } catch (error) {
    console.error('Update member API error:', error);

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        ResponseBuilder.notFound('Member not found'),
        { status: 404 }
      );
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        ResponseBuilder.validationError({ general: ['Invalid input data'] }),
        { status: 400 }
      );
    }

    return NextResponse.json(
      ResponseBuilder.error('Failed to update member', 'UPDATE_ERROR'),
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE /api/members/[id] - Delete member
// ============================================================

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { gymProfile, error: authError } = await getApiGymProfile();

    if (authError) {
      return authError;
    }

    // Use repository to delete member
    const container = await getContainer();
    const memberRepo = container.getMemberRepository();
    await memberRepo.delete(id, gymProfile!.id);

    return NextResponse.json(
      ResponseBuilder.success({ message: 'Member deleted successfully' }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Delete member API error:', error);

    return NextResponse.json(
      ResponseBuilder.error('Failed to delete member', 'DELETE_ERROR'),
      { status: 500 }
    );
  }
}
