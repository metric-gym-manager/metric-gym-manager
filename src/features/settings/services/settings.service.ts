import { createClient } from '@/lib/supabase/server';
import type { GymSettings, PlanType, Discount } from '../types';
import type {
  UpdateGymInfoInput,
  CreatePlanTypeInput,
  UpdatePlanTypeInput,
  CreateDiscountInput,
  UpdateDiscountInput,
} from '../schemas/settings.schemas';
import type { PlanTypeEnum } from '../schemas/settings.schemas';

// ============================================================
// GYM INFORMATION
// ============================================================

export async function updateGymInfo(
  gymId: string,
  input: UpdateGymInfoInput
): Promise<GymSettings> {
  const supabase = await createClient();

  const { data: gym, error } = await supabase
    .from('gyms')
    .update({
      gym_name: input.gym_name,
      gym_address: input.gym_address || null,
      gym_website: input.gym_website || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', gymId)
    .select('gym_name, gym_address, gym_website')
    .single();

  if (error || !gym) {
    throw new Error(`Failed to update gym information: ${error?.message}`);
  }

  return gym as GymSettings;
}

// ============================================================
// PLAN TYPES
// ============================================================

export async function getPlanTypes(gymId: string): Promise<PlanType[]> {
  const supabase = await createClient();

  const { data: planTypes, error } = await supabase
    .from('plan_types')
    .select('*')
    .eq('gym_id', gymId)
    .order('plan_type', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch plan types: ${error.message}`);
  }

  return (planTypes || []) as PlanType[];
}

export async function createPlanType(
  gymId: string,
  input: CreatePlanTypeInput
): Promise<PlanType> {
  const supabase = await createClient();

  // Check if plan type already exists for this gym
  const { data: existing } = await supabase
    .from('plan_types')
    .select('id')
    .eq('gym_id', gymId)
    .eq('plan_type', input.plan_type)
    .single();

  if (existing) {
    throw new Error('Plan type already exists for this gym');
  }

  // Create new plan type
  const { data: created, error } = await supabase
    .from('plan_types')
    .insert({
      gym_id: gymId,
      plan_type: input.plan_type,
      default_amount: input.default_amount,
      is_active: input.is_active ?? true,
    })
    .select()
    .single();

  if (error || !created) {
    throw new Error(`Failed to create plan type: ${error?.message}`);
  }

  return created as PlanType;
}

export async function updatePlanType(
  gymId: string,
  input: UpdatePlanTypeInput
): Promise<PlanType> {
  const supabase = await createClient();

  // Check if plan type exists for this gym
  const { data: existing } = await supabase
    .from('plan_types')
    .select('id')
    .eq('gym_id', gymId)
    .eq('plan_type', input.plan_type)
    .single();

  if (!existing) {
    throw new Error('Plan type not found');
  }

  // Update existing
  const { data: updated, error } = await supabase
    .from('plan_types')
    .update({
      default_amount: input.default_amount,
      is_active: input.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .select()
    .single();

  if (error || !updated) {
    throw new Error(`Failed to update plan type: ${error?.message}`);
  }

  return updated as PlanType;
}

export async function deletePlanType(
  gymId: string,
  planType: PlanTypeEnum
): Promise<void> {
  const supabase = await createClient();

  // Check if plan type is in use by any members
  const { data: membersWithPlan } = await supabase
    .from('members')
    .select('id')
    .eq('gym_id', gymId)
    .eq('plan_type', planType)
    .limit(1);

  if (membersWithPlan && membersWithPlan.length > 0) {
    throw new Error('Cannot delete plan type: it is currently in use by members');
  }

  // Delete the plan type
  const { error } = await supabase
    .from('plan_types')
    .delete()
    .eq('gym_id', gymId)
    .eq('plan_type', planType);

  if (error) {
    throw new Error(`Failed to delete plan type: ${error.message}`);
  }
}

// ============================================================
// DISCOUNTS
// ============================================================

export async function getDiscounts(gymId: string): Promise<Discount[]> {
  const supabase = await createClient();

  const { data: discounts, error } = await supabase
    .from('discounts')
    .select('*')
    .eq('gym_id', gymId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch discounts: ${error.message}`);
  }

  return (discounts || []) as Discount[];
}

export async function createDiscount(
  gymId: string,
  input: CreateDiscountInput
): Promise<Discount> {
  const supabase = await createClient();

  const { data: discount, error } = await supabase
    .from('discounts')
    .insert({
      gym_id: gymId,
      discount_name: input.discount_name,
      discount_percentage: input.discount_percentage,
      is_active: input.is_active ?? true,
    })
    .select()
    .single();

  if (error || !discount) {
    throw new Error(`Failed to create discount: ${error?.message}`);
  }

  return discount as Discount;
}

export async function updateDiscount(
  discountId: string,
  gymId: string,
  input: UpdateDiscountInput
): Promise<Discount> {
  const supabase = await createClient();

  const { data: discount, error } = await supabase
    .from('discounts')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', discountId)
    .eq('gym_id', gymId)
    .select()
    .single();

  if (error || !discount) {
    throw new Error(`Failed to update discount: ${error?.message}`);
  }

  return discount as Discount;
}

export async function deleteDiscount(
  discountId: string,
  gymId: string
): Promise<void> {
  const supabase = await createClient();

  // Check if discount is in use by any active members
  const { data: membersWithDiscount } = await supabase
    .from('members')
    .select('id')
    .eq('discount_id', discountId)
    .eq('status', 'active')
    .limit(1);

  if (membersWithDiscount && membersWithDiscount.length > 0) {
    throw new Error('Cannot delete discount: it is currently assigned to active members');
  }

  const { error } = await supabase
    .from('discounts')
    .delete()
    .eq('id', discountId)
    .eq('gym_id', gymId);

  if (error) {
    throw new Error(`Failed to delete discount: ${error.message}`);
  }
}
