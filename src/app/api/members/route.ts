import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { addMemberSchema, memberFiltersSchema } from '@/features/members/schemas/member.schemas';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createMemberRepository, createRegisterMember } from '@/features/members';
import { ResponseBuilder } from '@/utils/api/ApiResponse';
import { ConflictError, MemberLimitError, ValidationError } from '@/utils/errors';
import { PlanType } from '@/features/members/config/PlanConfig';
import { serializeMemberForAPI } from '@/features/members/utils/serializeMemberForAPI';

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
    const memberRepo = createMemberRepository(await createClient());

    const result = await memberRepo.findAll({
      gymId: gymProfile.id,
      ...validatedFilters,
      planType: validatedFilters.planType as PlanType | undefined,
    });

    // Fetch discount data for members that have discounts
    const discountIds = result.items
      .map(member => member.toDatabase().discountId)
      .filter((id): id is string => id !== null);

    const uniqueDiscountIds = Array.from(new Set(discountIds));

    let discountsMap: Record<string, { id: string; discount_name: string; discount_percentage: number }> = {};

    if (uniqueDiscountIds.length > 0) {
      const supabase = (await import('@/lib/supabase/server')).createClient();
      const { data: discounts } = await (await supabase)
        .from('discounts')
        .select('id, discount_name, discount_percentage')
        .in('id', uniqueDiscountIds);

      if (discounts) {
        discountsMap = discounts.reduce((acc, discount) => {
          acc[discount.id] = discount;
          return acc;
        }, {} as Record<string, { id: string; discount_name: string; discount_percentage: number }>);
      }
    }

    // Serialize domain entities for API response with properly formatted dates and discount data
    const membersData = result.items.map(member => {
      const props = member.toDatabase();
      const discount = props.discountId ? discountsMap[props.discountId] : null;
      return serializeMemberForAPI(member, discount);
    });

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

    // Register member via use case. Admin container on purpose: the guarded
    // quota RPC is EXECUTE-granted to service_role only, and the caller's
    // gym id was already pinned by getCurrentGymProfile() above (plan C-15).
    const registerMember = createRegisterMember(createAdminClient());

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

    // Serialize domain entity for API response with properly formatted dates
    const memberData = serializeMemberForAPI(result.member);

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

    if (error instanceof MemberLimitError) {
      // Machine-readable code: the frontend keys the upgrade prompt on it
      return NextResponse.json(
        ResponseBuilder.error(error.message, 'MEMBER_LIMIT_REACHED'),
        { status: 403 }
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
