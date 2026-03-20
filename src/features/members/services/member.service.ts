import { createClient } from '@/lib/supabase/server';
import type {
  Member,
  MemberWithDiscount,
  MembersListResponse,
  MemberDetailResponse,
  OverdueMember,
} from '../types';
import type {
  AddMemberInput,
  UpdateMemberInput,
  MemberFiltersInput,
} from '../schemas/member.schemas';

// ============================================================
// GET MEMBERS LIST
// ============================================================

export async function getMembersList(
  gymId: string,
  filters: MemberFiltersInput
): Promise<MembersListResponse> {
  const supabase = await createClient();
  const { search, status, planType, sortBy, page, limit } = filters;

  // Build query
  let query = supabase
    .from('members')
    .select(
      `
      *,
      discount:discounts(id, discount_name, discount_percentage)
    `,
      { count: 'exact' }
    )
    .eq('gym_id', gymId);

  // Apply filters
  if (search) {
    query = query.or(`name.ilike.%${search}%,phone_number.ilike.%${search}%`);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (planType) {
    query = query.eq('plan_type', planType);
  }

  // Apply sorting
  switch (sortBy) {
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    case 'upcoming_due':
      query = query.order('next_due_date', { ascending: true });
      break;
    case 'recently_expired':
      query = query.eq('status', 'expired').order('updated_at', { ascending: false });
      break;
    case 'newest':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  // Apply pagination
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data: members, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch members: ${error.message}`);
  }

  // Get overdue members (expired status members)
  // Since we auto-expire members when due date passes, all overdue members have 'expired' status
  const { data: overdueData, error: overdueError } = await supabase
    .from('members')
    .select('*')
    .eq('gym_id', gymId)
    .eq('status', 'expired')
    .order('next_due_date', { ascending: true });

  if (overdueError) {
    throw new Error(`Failed to fetch overdue members: ${overdueError.message}`);
  }

  // Calculate days overdue
  const overdueMembers: OverdueMember[] = (overdueData || []).map((member) => {
    const dueDate = new Date(member.next_due_date);
    const today = new Date();
    const daysOverdue = Math.floor(
      (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      ...member,
      days_overdue: daysOverdue,
    } as OverdueMember;
  });

  // Map members to MemberWithDiscount type
  const mappedMembers: MemberWithDiscount[] = (members || []) as MemberWithDiscount[];

  return {
    members: mappedMembers,
    overdueMembers,
    totalCount: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

// ============================================================
// GET MEMBER BY ID
// ============================================================

export async function getMemberById(
  memberId: string,
  gymId: string
): Promise<MemberDetailResponse> {
  const supabase = await createClient();

  // Get member with discount
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select(
      `
      *,
      discount:discounts(id, discount_name, discount_percentage)
    `
    )
    .eq('id', memberId)
    .eq('gym_id', gymId)
    .single();

  if (memberError || !member) {
    throw new Error('Member not found');
  }

  // Get payment history
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('*')
    .eq('member_id', memberId)
    .order('payment_date', { ascending: false });

  if (paymentsError) {
    throw new Error(`Failed to fetch payments: ${paymentsError.message}`);
  }

  return {
    member: member as MemberWithDiscount,
    payments: payments || [],
  };
}

// ============================================================
// CREATE MEMBER
// ============================================================

export async function createMember(
  gymId: string,
  input: AddMemberInput
): Promise<Member> {
  const supabase = await createClient();

  // Calculate next due date
  const startDate = new Date(input.membershipStartDate);
  let nextDueDate = new Date(startDate);

  switch (input.planType) {
    case 'daily':
      nextDueDate.setDate(nextDueDate.getDate() + 1);
      break;
    case 'weekly':
      nextDueDate.setDate(nextDueDate.getDate() + 7);
      break;
    case 'monthly':
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      break;
    case '3-months':
      nextDueDate.setMonth(nextDueDate.getMonth() + 3);
      break;
    case '6-months':
      nextDueDate.setMonth(nextDueDate.getMonth() + 6);
      break;
    case 'annual':
      nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
      break;
  }

  // Create member
  // For backdated members, set registered_date to membership_start_date
  const { data: member, error: memberError } = await supabase
    .from('members')
    .insert({
      gym_id: gymId,
      name: input.name,
      phone_number: input.phoneNumber,
      plan_type: input.planType,
      plan_amount: input.planAmount,
      discount_id: input.discountId || null,
      recurring_discount: input.recurringDiscount ?? false,
      status: 'active',
      registered_date: input.membershipStartDate, // Use membership start date for backdating
      membership_start_date: input.membershipStartDate,
      next_due_date: nextDueDate.toISOString().split('T')[0],
    })
    .select()
    .single();

  if (memberError || !member) {
    throw new Error(`Failed to create member: ${memberError?.message}`);
  }

  // Get discount info if applicable
  let discountName: string | null = null;
  let discountPercentage: number | null = null;

  if (input.discountId) {
    const { data: discount } = await supabase
      .from('discounts')
      .select('discount_name, discount_percentage')
      .eq('id', input.discountId)
      .single();

    if (discount) {
      discountName = discount.discount_name;
      discountPercentage = discount.discount_percentage;
    }
  }

  // Record first payment (registration payment on the membership start date)
  // Use the membership_start_date to support backdated registrations
  const { error: paymentError } = await supabase.from('payments').insert({
    gym_id: gymId,
    member_id: member.id,
    payment_date: input.membershipStartDate,
    amount_paid: input.paymentAmount,
    discount_applied: discountName,
    discount_percentage: discountPercentage,
    next_due_date_calculated: nextDueDate.toISOString().split('T')[0],
  });

  if (paymentError) {
    console.error('Failed to record initial payment:', paymentError);
    // Don't fail member creation if payment logging fails
  }

  // Return member with payment amount for SMS
  return {
    ...member,
    payment_amount: input.paymentAmount,
  } as Member;
}

// ============================================================
// UPDATE MEMBER
// ============================================================

export async function updateMember(
  memberId: string,
  gymId: string,
  input: UpdateMemberInput
): Promise<Member> {
  const supabase = await createClient();

  // Build update object with only the fields that were provided
  // Map camelCase to snake_case for database columns
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.phoneNumber !== undefined) updateData.phone_number = input.phoneNumber;
  if (input.planType !== undefined) updateData.plan_type = input.planType;
  if (input.planAmount !== undefined) updateData.plan_amount = input.planAmount;
  if (input.discountId !== undefined) updateData.discount_id = input.discountId;
  if (input.recurringDiscount !== undefined) updateData.recurring_discount = input.recurringDiscount;
  if (input.status !== undefined) updateData.status = input.status;

  const { data: member, error } = await supabase
    .from('members')
    .update(updateData)
    .eq('id', memberId)
    .eq('gym_id', gymId)
    .select()
    .single();

  if (error || !member) {
    throw new Error(`Failed to update member: ${error?.message}`);
  }

  return member as Member;
}

// ============================================================
// DELETE MEMBER
// ============================================================

export async function deleteMember(
  memberId: string,
  gymId: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', memberId)
    .eq('gym_id', gymId);

  if (error) {
    throw new Error(`Failed to delete member: ${error.message}`);
  }
}
