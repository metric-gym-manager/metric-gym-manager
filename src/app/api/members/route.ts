import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { addMemberSchema, memberFiltersSchema } from '@/features/members/schemas/member.schemas';
import { getContainer } from '@/infrastructure/di';
import { ResponseBuilder } from '@/core/utils/api/ApiResponse';
import { ConflictError, ValidationError } from '@/core/utils/errors';
import { PlanType } from '@/core/utils/constants/PlanConfig';

// ============================================================
// GET /api/members - Get members list
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const filters = {
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      planType: searchParams.get('planType') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
    };

    // Validate filters
    const validatedFilters = memberFiltersSchema.parse(filters);

    // Get members via repository
    const container = await getContainer();
    const memberRepo = container.getMemberRepository();

    const result = await memberRepo.findAll({
      gymId: gymProfile.id,
      ...validatedFilters,
      planType: validatedFilters.planType as PlanType | undefined,
    });

    // Convert domain entities to database format for API response
    const membersData = result.items.map(member => member.toDatabase());

    return NextResponse.json(
      ResponseBuilder.success({
        members: membersData,
        totalCount: result.totalCount,
        page: result.page,
        totalPages: result.totalPages,
      })
    );
  } catch (error) {
    console.error('Get members API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        ResponseBuilder.unauthorized(),
        { status: 401 }
      );
    }

    return NextResponse.json(
      ResponseBuilder.error('Failed to fetch members', 'FETCH_ERROR'),
      { status: 500 }
    );
  }
}

// ============================================================
// POST /api/members - Create new member
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();
    const body = await request.json();

    // Validate input
    const validatedData = addMemberSchema.parse(body);

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

    // Register member via use case
    const container = await getContainer();
    const registerMember = container.getRegisterMemberUseCase();

    const result = await registerMember.execute({
      gymId: gymProfile.id,
      name: validatedData.name,
      phoneNumber: validatedData.phoneNumber,
      planType: validatedData.planType as PlanType,
      planAmount: validatedData.planAmount,
      discountId: validatedData.discountId || null,
      recurringDiscount: validatedData.recurringDiscount ?? false,
      membershipStartDate: new Date(validatedData.membershipStartDate),
      paymentAmount: validatedData.paymentAmount,
      discount,
    });

    // Convert domain entity to database format for API response
    const memberData = result.member.toDatabase();

    return NextResponse.json(
      ResponseBuilder.success(memberData, { message: 'Member registered successfully' }),
      { status: 201 }
    );
  } catch (error) {
    console.error('Create member API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        ResponseBuilder.unauthorized(),
        { status: 401 }
      );
    }

    if (error instanceof ConflictError) {
      return NextResponse.json(
        ResponseBuilder.conflict(error.message),
        { status: 409 }
      );
    }

    if (error instanceof ValidationError) {
      return NextResponse.json(
        ResponseBuilder.validationError({ general: [error.message] }),
        { status: 400 }
      );
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        ResponseBuilder.validationError({ general: ['Invalid input data'] }),
        { status: 400 }
      );
    }

    return NextResponse.json(
      ResponseBuilder.error('Failed to create member', 'CREATE_ERROR'),
      { status: 500 }
    );
  }
}
