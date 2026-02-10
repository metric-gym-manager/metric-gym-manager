import { createClient } from '@/lib/supabase/server'
import { CreatePlanInput, UpdatePlanInput } from '../schemas/memberships.schemas'
import { MembershipPlan } from '../types'

// Type definitions for Supabase queries
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

/**
 * Create a new membership plan
 */
export async function createPlan(
  gymId: string,
  input: CreatePlanInput
): Promise<MembershipPlan> {
  const supabase = await createClient()

  const { data: plan, error } = await supabase
    .from('membership_plans')
    .insert({
      gym_id: gymId,
      name: input.name,
      description: input.description || null,
      plan_type: input.planType,
      price_amount: input.priceAmount,
      billing_frequency: input.billingFrequency,
      trial_days: input.trialDays ?? 0,
      access_level: input.accessLevel ?? 'business_hours',
      class_credits: input.classCredits || null,
      contract_length_months: input.contractLengthMonths || null,
      setup_fee: input.setupFee ?? 0,
      is_active: input.isActive ?? true,
    })
    .select()
    .single<PlanRow>()

  if (error) throw error

  return {
    id: plan.id,
    gymId: plan.gym_id,
    name: plan.name,
    description: plan.description || undefined,
    planType: plan.plan_type as MembershipPlan['planType'],
    priceAmount: parseFloat(plan.price_amount),
    billingFrequency: plan.billing_frequency as MembershipPlan['billingFrequency'],
    trialDays: plan.trial_days,
    accessLevel: plan.access_level,
    classCredits: plan.class_credits || undefined,
    contractLengthMonths: plan.contract_length_months || undefined,
    setupFee: parseFloat(plan.setup_fee),
    isActive: plan.is_active,
    createdAt: new Date(plan.created_at),
    updatedAt: new Date(plan.updated_at),
  }
}

/**
 * Get plan by ID
 */
export async function getPlanById(planId: string): Promise<MembershipPlan | null> {
  const supabase = await createClient()

  const { data: plan, error } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('id', planId)
    .maybeSingle<PlanRow>()

  if (error) throw error
  if (!plan) return null

  return {
    id: plan.id,
    gymId: plan.gym_id,
    name: plan.name,
    description: plan.description || undefined,
    planType: plan.plan_type as MembershipPlan['planType'],
    priceAmount: parseFloat(plan.price_amount),
    billingFrequency: plan.billing_frequency as MembershipPlan['billingFrequency'],
    trialDays: plan.trial_days,
    accessLevel: plan.access_level,
    classCredits: plan.class_credits || undefined,
    contractLengthMonths: plan.contract_length_months || undefined,
    setupFee: parseFloat(plan.setup_fee),
    isActive: plan.is_active,
    createdAt: new Date(plan.created_at),
    updatedAt: new Date(plan.updated_at),
  }
}

/**
 * List plans for a gym
 */
export async function listPlans(
  gymId: string,
  filters?: {
    planType?: string
    isActive?: boolean
  }
): Promise<MembershipPlan[]> {
  const supabase = await createClient()

  let query = supabase
    .from('membership_plans')
    .select('*')
    .eq('gym_id', gymId)

  if (filters?.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive)
  }

  if (filters?.planType) {
    query = query.eq('plan_type', filters.planType)
  }

  query = query.order('created_at', { ascending: false })

  const { data: plans, error } = await query.returns<PlanRow[]>()

  if (error) throw error

  return plans.map((plan) => ({
    id: plan.id,
    gymId: plan.gym_id,
    name: plan.name,
    description: plan.description || undefined,
    planType: plan.plan_type as MembershipPlan['planType'],
    priceAmount: parseFloat(plan.price_amount),
    billingFrequency: plan.billing_frequency as MembershipPlan['billingFrequency'],
    trialDays: plan.trial_days,
    accessLevel: plan.access_level,
    classCredits: plan.class_credits || undefined,
    contractLengthMonths: plan.contract_length_months || undefined,
    setupFee: parseFloat(plan.setup_fee),
    isActive: plan.is_active,
    createdAt: new Date(plan.created_at),
    updatedAt: new Date(plan.updated_at),
  }))
}

/**
 * Update plan
 */
export async function updatePlan(
  planId: string,
  input: UpdatePlanInput
): Promise<MembershipPlan> {
  const supabase = await createClient()

  const updateData: Record<string, any> = {}

  if (input.name !== undefined) {
    updateData.name = input.name
  }

  if (input.description !== undefined) {
    updateData.description = input.description
  }

  if (input.planType !== undefined) {
    updateData.plan_type = input.planType
  }

  if (input.priceAmount !== undefined) {
    updateData.price_amount = input.priceAmount
  }

  if (input.billingFrequency !== undefined) {
    updateData.billing_frequency = input.billingFrequency
  }

  if (input.trialDays !== undefined) {
    updateData.trial_days = input.trialDays
  }

  if (input.accessLevel !== undefined) {
    updateData.access_level = input.accessLevel
  }

  if (input.classCredits !== undefined) {
    updateData.class_credits = input.classCredits
  }

  if (input.contractLengthMonths !== undefined) {
    updateData.contract_length_months = input.contractLengthMonths
  }

  if (input.setupFee !== undefined) {
    updateData.setup_fee = input.setupFee
  }

  if (input.isActive !== undefined) {
    updateData.is_active = input.isActive
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('No fields to update')
  }

  const { data: plan, error } = await supabase
    .from('membership_plans')
    .update(updateData)
    .eq('id', planId)
    .select()
    .single<PlanRow>()

  if (error) throw error
  if (!plan) throw new Error('Plan not found')

  return {
    id: plan.id,
    gymId: plan.gym_id,
    name: plan.name,
    description: plan.description || undefined,
    planType: plan.plan_type as MembershipPlan['planType'],
    priceAmount: parseFloat(plan.price_amount),
    billingFrequency: plan.billing_frequency as MembershipPlan['billingFrequency'],
    trialDays: plan.trial_days,
    accessLevel: plan.access_level,
    classCredits: plan.class_credits || undefined,
    contractLengthMonths: plan.contract_length_months || undefined,
    setupFee: parseFloat(plan.setup_fee),
    isActive: plan.is_active,
    createdAt: new Date(plan.created_at),
    updatedAt: new Date(plan.updated_at),
  }
}

/**
 * Deactivate plan
 */
export async function deactivatePlan(planId: string): Promise<MembershipPlan> {
  const supabase = await createClient()

  const { data: plan, error } = await supabase
    .from('membership_plans')
    .update({ is_active: false })
    .eq('id', planId)
    .select()
    .single<PlanRow>()

  if (error) throw error
  if (!plan) throw new Error('Plan not found')

  return {
    id: plan.id,
    gymId: plan.gym_id,
    name: plan.name,
    description: plan.description || undefined,
    planType: plan.plan_type as MembershipPlan['planType'],
    priceAmount: parseFloat(plan.price_amount),
    billingFrequency: plan.billing_frequency as MembershipPlan['billingFrequency'],
    trialDays: plan.trial_days,
    accessLevel: plan.access_level,
    classCredits: plan.class_credits || undefined,
    contractLengthMonths: plan.contract_length_months || undefined,
    setupFee: parseFloat(plan.setup_fee),
    isActive: plan.is_active,
    createdAt: new Date(plan.created_at),
    updatedAt: new Date(plan.updated_at),
  }
}
