import { createClient } from '@/lib/supabase/server'
import { AssignPlanInput } from '../schemas/memberships.schemas'
import { MemberMembership } from '../types'

// Type definitions for Supabase queries
type MemberRow = {
  id: string
  gym_id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  date_of_birth: string | null
  gender: string | null
  address: any | null
  photo_url: string | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

type PlanRow = {
  id: string
  gym_id: string
  name: string
  description: string | null
  plan_type: string
  price_amount: string
  billing_frequency: string
  trial_days: number
  access_level: string
  class_credits: number | null
  contract_length_months: number | null
  setup_fee: string
  is_active: boolean
  created_at: string
  updated_at: string
}

type MembershipRow = {
  id: string
  member_id: string
  plan_id: string
  status: string
  start_date: string
  end_date: string | null
  next_billing_date: string | null
  auto_renew: boolean
  created_at: string
  updated_at: string
}

/**
 * Assign plan to member
 */
export async function assignPlanToMember(
  memberId: string,
  planId: string,
  startDate: Date,
  autoRenew?: boolean
): Promise<MemberMembership> {
  const supabase = await createClient()

  // 1. Check member exists and get gym_id
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('gym_id, status')
    .eq('id', memberId)
    .single<Pick<MemberRow, 'gym_id' | 'status'>>()

  if (memberError || !member) {
    throw new Error('Member not found')
  }

  const memberStatus = member.status
  if (memberStatus !== 'active' && memberStatus !== 'pending') {
    throw new Error('Member must be active or pending to assign a membership')
  }

  // 2. Check plan exists and is active
  const { data: plan, error: planError } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('id', planId)
    .single<PlanRow>()

  if (planError || !plan) {
    throw new Error('Plan not found')
  }

  if (!plan.is_active) {
    throw new Error('Cannot assign an inactive plan')
  }

  // 3. Calculate dates (keep existing JavaScript logic)
  const start = new Date(startDate)
  let endDate: Date | null = null
  let nextBillingDate: Date | null = null
  const shouldAutoRenew = autoRenew ?? true

  if (plan.billing_frequency === 'monthly') {
    endDate = new Date(start)
    endDate.setMonth(endDate.getMonth() + 1)
    nextBillingDate = new Date(endDate)
  } else if (plan.billing_frequency === 'annual') {
    endDate = new Date(start)
    endDate.setFullYear(endDate.getFullYear() + 1)
    nextBillingDate = new Date(endDate)
  } else if (plan.billing_frequency === 'one_time') {
    // For one-time plans, no auto-renew and no next billing date
    nextBillingDate = null
  }

  // 4. Insert member membership with pending status
  const { data: membership, error } = await supabase
    .from('member_memberships')
    .insert({
      member_id: memberId,
      plan_id: planId,
      status: 'pending',
      start_date: start.toISOString().split('T')[0],
      end_date: endDate ? endDate.toISOString().split('T')[0] : null,
      next_billing_date: nextBillingDate ? nextBillingDate.toISOString().split('T')[0] : null,
      auto_renew: plan.billing_frequency !== 'one_time' && shouldAutoRenew,
    })
    .select()
    .single<MembershipRow>()

  if (error) throw error

  return {
    id: membership.id,
    memberId: membership.member_id,
    planId: membership.plan_id,
    status: membership.status as MemberMembership['status'],
    startDate: new Date(membership.start_date),
    endDate: membership.end_date ? new Date(membership.end_date) : undefined,
    nextBillingDate: membership.next_billing_date ? new Date(membership.next_billing_date) : undefined,
    autoRenew: membership.auto_renew,
    createdAt: new Date(membership.created_at),
    updatedAt: new Date(membership.updated_at),
  }
}

/**
 * Get member's active membership
 */
export async function getMemberActiveMembership(
  memberId: string
): Promise<MemberMembership | null> {
  const supabase = await createClient()

  const { data: membership, error } = await supabase
    .from('member_memberships')
    .select('*')
    .eq('member_id', memberId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<MembershipRow>()

  if (error) throw error
  if (!membership) return null

  return {
    id: membership.id,
    memberId: membership.member_id,
    planId: membership.plan_id,
    status: membership.status as MemberMembership['status'],
    startDate: new Date(membership.start_date),
    endDate: membership.end_date ? new Date(membership.end_date) : undefined,
    nextBillingDate: membership.next_billing_date ? new Date(membership.next_billing_date) : undefined,
    autoRenew: membership.auto_renew,
    createdAt: new Date(membership.created_at),
    updatedAt: new Date(membership.updated_at),
  }
}

/**
 * Cancel membership
 */
export async function cancelMembership(
  membershipId: string
): Promise<MemberMembership> {
  const supabase = await createClient()

  const { data: membership, error } = await supabase
    .from('member_memberships')
    .update({
      status: 'cancelled',
      end_date: new Date().toISOString().split('T')[0],
    })
    .eq('id', membershipId)
    .select()
    .single<MembershipRow>()

  if (error) throw error
  if (!membership) throw new Error('Membership not found')

  return {
    id: membership.id,
    memberId: membership.member_id,
    planId: membership.plan_id,
    status: membership.status as MemberMembership['status'],
    startDate: new Date(membership.start_date),
    endDate: membership.end_date ? new Date(membership.end_date) : undefined,
    nextBillingDate: membership.next_billing_date ? new Date(membership.next_billing_date) : undefined,
    autoRenew: membership.auto_renew,
    createdAt: new Date(membership.created_at),
    updatedAt: new Date(membership.updated_at),
  }
}

/**
 * Get member membership history
 */
export async function getMemberMembershipHistory(
  memberId: string
): Promise<MemberMembership[]> {
  const supabase = await createClient()

  const { data: memberships, error } = await supabase
    .from('member_memberships')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .returns<MembershipRow[]>()

  if (error) throw error

  return memberships.map((membership) => ({
    id: membership.id,
    memberId: membership.member_id,
    planId: membership.plan_id,
    status: membership.status as MemberMembership['status'],
    startDate: new Date(membership.start_date),
    endDate: membership.end_date ? new Date(membership.end_date) : undefined,
    nextBillingDate: membership.next_billing_date ? new Date(membership.next_billing_date) : undefined,
    autoRenew: membership.auto_renew,
    createdAt: new Date(membership.created_at),
    updatedAt: new Date(membership.updated_at),
  }))
}
