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
      discount:discounts(id, discount_name, discount_percentage),
      member_installments(id, status)
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

  // Get overdue members (>7 days past due)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: overdueData, error: overdueError } = await supabase
    .from('members')
    .select('*')
    .eq('gym_id', gymId)
    .eq('status', 'active')
    .lt('next_due_date', sevenDaysAgo.toISOString().split('T')[0])
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

  // Map members and compute has_installment from the joined data
  type RawMember = typeof members extends (infer T)[] | null ? T : never;
  const mappedMembers: MemberWithDiscount[] = (members || []).map((m: RawMember) => {
    const raw = m as Record<string, unknown>;
    const installments = (raw.member_installments as Array<{ id: string; status: string }> | null) ?? [];
    const hasInstallment = installments.some((inst) => inst.status === 'active');
    // Remove the joined field before spreading
    const { member_installments: _mi, ...memberData } = raw;
    void _mi;
    return {
      ...memberData,
      has_installment: hasInstallment,
    } as MemberWithDiscount;
  });

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
    case 'monthly':
      nextDueDate.setDate(nextDueDate.getDate() + 30);
      break;
    case 'annual':
      nextDueDate.setDate(nextDueDate.getDate() + 365);
      break;
  }

  // Create member
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

  // Record first payment
  await supabase.from('payments').insert({
    member_id: member.id,
    payment_date: input.membershipStartDate,
    amount_paid: input.paymentAmount,
    discount_applied: discountName,
    discount_percentage: discountPercentage,
    next_due_date_calculated: nextDueDate.toISOString().split('T')[0],
  });

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

  const { data: member, error } = await supabase
    .from('members')
    .update({
      ...input,
      phone_number: input.phoneNumber,
      plan_type: input.planType,
      plan_amount: input.planAmount,
      discount_id: input.discountId,
      recurring_discount: input.recurringDiscount ?? false,
      updated_at: new Date().toISOString(),
    })
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
