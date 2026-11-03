import { createClient } from '@/lib/supabase/server'
import type {
  GymSettings,
  PlanType,
  Discount,
  AdmissionFeeSettings,
  GymPolicies,
} from '../types'
import type {
  UpdateGymInfoInput,
  CreatePlanTypeInput,
  UpdatePlanTypeInput,
  CreateDiscountInput,
  UpdateDiscountInput,
  UpdateAdmissionFeeInput,
  UpdateGymPoliciesInput,
} from '../schemas/settings.schemas'
import type { PlanTypeEnum } from '../schemas/settings.schemas'
import {
  DEFAULT_GYM_RULES,
  DEFAULT_GYM_TERMS,
} from '../config/defaultGymPolicies'

// ============================================================
// GYM INFORMATION
// ============================================================

export async function updateGymInfo(
  gymId: string,
  input: UpdateGymInfoInput
): Promise<GymSettings> {
  const supabase = await createClient()

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
    .single()

  if (error || !gym) {
    throw new Error(`Failed to update gym information: ${error?.message}`)
  }

  return gym as GymSettings
}

// ============================================================
// ADMISSION FEE
// ============================================================

export async function getAdmissionFee(
  gymId: string
): Promise<AdmissionFeeSettings> {
  const supabase = await createClient()

  const { data: gym, error } = await supabase
    .from('gyms')
    .select('admission_fee, admission_fee_enabled')
    .eq('id', gymId)
    .single()

  if (error || !gym) {
    throw new Error(`Failed to fetch admission fee: ${error?.message}`)
  }

  return {
    admission_fee: Number(gym.admission_fee) || 0,
    admission_fee_enabled: Boolean(gym.admission_fee_enabled),
  }
}

export async function updateAdmissionFee(
  gymId: string,
  input: UpdateAdmissionFeeInput
): Promise<AdmissionFeeSettings> {
  const supabase = await createClient()

  const { data: gym, error } = await supabase
    .from('gyms')
    .update({
      admission_fee: input.admission_fee,
      admission_fee_enabled: input.admission_fee_enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', gymId)
    .select('admission_fee, admission_fee_enabled')
    .single()

  if (error || !gym) {
    throw new Error(`Failed to update admission fee: ${error?.message}`)
  }

  return {
    admission_fee: Number(gym.admission_fee) || 0,
    admission_fee_enabled: Boolean(gym.admission_fee_enabled),
  }
}

// ============================================================
// GYM POLICIES (rules & terms of service)
// ============================================================

export async function getGymPolicies(gymId: string): Promise<GymPolicies> {
  const supabase = await createClient()

  const { data: gym, error } = await supabase
    .from('gyms')
    .select('gym_rules, gym_terms')
    .eq('id', gymId)
    .single()

  if (error || !gym) {
    throw new Error(`Failed to fetch gym policies: ${error?.message}`)
  }

  // Fall back to the pre-generated defaults for gyms predating the seed.
  return {
    gym_rules: (gym.gym_rules as string | null) ?? DEFAULT_GYM_RULES,
    gym_terms: (gym.gym_terms as string | null) ?? DEFAULT_GYM_TERMS,
  }
}

export async function updateGymPolicies(
  gymId: string,
  input: UpdateGymPoliciesInput
): Promise<GymPolicies> {
  const supabase = await createClient()

  const { data: gym, error } = await supabase
    .from('gyms')
    .update({
      gym_rules: input.gym_rules,
      gym_terms: input.gym_terms,
      updated_at: new Date().toISOString(),
    })
    .eq('id', gymId)
    .select('gym_rules, gym_terms')
    .single()

  if (error || !gym) {
    throw new Error(`Failed to update gym policies: ${error?.message}`)
  }

  return {
    gym_rules: gym.gym_rules as string,
    gym_terms: gym.gym_terms as string,
  }
}

// ============================================================
// PLAN TYPES
// ============================================================

export async function getPlanTypes(gymId: string): Promise<PlanType[]> {
  const supabase = await createClient()

  const { data: planTypes, error } = await supabase
    .from('plan_types')
    .select('*')
    .eq('gym_id', gymId)
    .order('plan_type', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch plan types: ${error.message}`)
  }

  return (planTypes || []) as PlanType[]
}

export async function createPlanType(
  gymId: string,
  input: CreatePlanTypeInput
): Promise<PlanType> {
  const supabase = await createClient()

  // Check if plan type already exists for this gym
  const { data: existing } = await supabase
    .from('plan_types')
    .select('id')
    .eq('gym_id', gymId)
    .eq('plan_type', input.plan_type)
    .single()

  if (existing) {
    throw new Error('Plan type already exists for this gym')
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
    .single()

  if (error || !created) {
    throw new Error(`Failed to create plan type: ${error?.message}`)
  }

  return created as PlanType
}

export async function updatePlanType(
  gymId: string,
  input: UpdatePlanTypeInput
): Promise<PlanType> {
  const supabase = await createClient()

  // Check if plan type exists for this gym
  const { data: existing } = await supabase
    .from('plan_types')
    .select('id')
    .eq('gym_id', gymId)
    .eq('plan_type', input.plan_type)
    .single()

  if (!existing) {
    throw new Error('Plan type not found')
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
    .single()

  if (error || !updated) {
    throw new Error(`Failed to update plan type: ${error?.message}`)
  }

  return updated as PlanType
}

export async function deletePlanType(
  gymId: string,
  planType: PlanTypeEnum
): Promise<void> {
  const supabase = await createClient()

  // Check if plan type is in use by any members
  const { data: membersWithPlan } = await supabase
    .from('members')
    .select('id')
    .eq('gym_id', gymId)
    .eq('plan_type', planType)
    .limit(1)

  if (membersWithPlan && membersWithPlan.length > 0) {
    throw new Error(
      'Cannot delete plan type: it is currently in use by members'
    )
  }

  // Delete the plan type
  const { error } = await supabase
    .from('plan_types')
    .delete()
    .eq('gym_id', gymId)
    .eq('plan_type', planType)

  if (error) {
    throw new Error(`Failed to delete plan type: ${error.message}`)
  }
}

// ============================================================
// DISCOUNTS
// ============================================================

export async function getDiscounts(gymId: string): Promise<Discount[]> {
  const supabase = await createClient()

  const { data: discounts, error } = await supabase
    .from('discounts')
    .select('*')
    .eq('gym_id', gymId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch discounts: ${error.message}`)
  }

  return (discounts || []) as Discount[]
}

export async function createDiscount(
  gymId: string,
  input: CreateDiscountInput
): Promise<Discount> {
  const supabase = await createClient()

  const { data: discount, error } = await supabase
    .from('discounts')
    .insert({
      gym_id: gymId,
      discount_name: input.discount_name,
      discount_percentage: input.discount_percentage,
      is_active: input.is_active ?? true,
    })
    .select()
    .single()

  if (error || !discount) {
    throw new Error(`Failed to create discount: ${error?.message}`)
  }

  return discount as Discount
}

export async function updateDiscount(
  discountId: string,
  gymId: string,
  input: UpdateDiscountInput
): Promise<Discount> {
  const supabase = await createClient()

  const { data: discount, error } = await supabase
    .from('discounts')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', discountId)
    .eq('gym_id', gymId)
    .select()
    .single()

  if (error || !discount) {
    throw new Error(`Failed to update discount: ${error?.message}`)
  }

  return discount as Discount
}

export async function deleteDiscount(
  discountId: string,
  gymId: string
): Promise<void> {
  const supabase = await createClient()

  // Check if discount is in use by any active members
  const { data: membersWithDiscount } = await supabase
    .from('members')
    .select('id')
    .eq('discount_id', discountId)
    .eq('status', 'active')
    .limit(1)

  if (membersWithDiscount && membersWithDiscount.length > 0) {
    throw new Error(
      'Cannot delete discount: it is currently assigned to active members'
    )
  }

  const { error } = await supabase
    .from('discounts')
    .delete()
    .eq('id', discountId)
    .eq('gym_id', gymId)

  if (error) {
    throw new Error(`Failed to delete discount: ${error.message}`)
  }
}

// ============================================================
// Gym profile settings (extracted verbatim from the settings routes)
// ============================================================

/** Persist a validated profile-image data URL on the gym row. Throws on failure. */
export async function updateGymProfileImage(
  gymId: string,
  imageUrl: string
): Promise<void> {
  const supabase = await createClient()

  const { error: updateError } = await supabase
    .from('gyms')
    .update({ profile_image_url: imageUrl })
    .eq('id', gymId)

  if (updateError) {
    throw new Error(`Failed to update profile image: ${updateError.message}`)
  }
}

/** Clear the gym profile image, resetting it to the initials fallback. */
export async function removeGymProfileImage(gymId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('gyms')
    .update({ profile_image_url: null })
    .eq('id', gymId)

  if (error) {
    throw new Error(`Failed to remove profile image: ${error.message}`)
  }
}

export type UpdateUsernameResult =
  | { status: 'taken' }
  | { status: 'error' }
  | { status: 'ok'; profile: Record<string, unknown> }

/** Update the gym's login username after a cross-tenant uniqueness check. */
export async function updateGymUsername(
  gymId: string,
  username: string
): Promise<UpdateUsernameResult> {
  const supabase = await createClient()

  // Check if username is already taken by another gym
  const { data: existingGym } = await supabase
    .from('gyms')
    .select('id')
    .eq('username', username)
    .neq('id', gymId)
    .single()

  if (existingGym) {
    return { status: 'taken' }
  }

  const { data: updatedProfile, error: updateError } = await supabase
    .from('gyms')
    .update({
      username,
      updated_at: new Date().toISOString(),
    })
    .eq('id', gymId)
    .select()
    .single()

  if (updateError) {
    console.error('Update username error:', updateError)
    return { status: 'error' }
  }

  return { status: 'ok', profile: updatedProfile }
}

export type UpdateGymPhoneResult =
  | { status: 'taken' }
  | { status: 'error' }
  | { status: 'ok'; profile: { id: string; phone_number: string } }

/**
 * Save the owner's phone number on their own gym row.
 *
 * There is no "is it taken?" lookup first. Under RLS a gym session sees only
 * its own row, so a session-client search for another gym's number finds
 * nothing whether or not one holds it. The UNIQUE constraint
 * `gyms_phone_number_key` decides, and its violation (Postgres 23505) is
 * reported as `taken`.
 *
 * @param gymId - The signed-in owner's gym
 * @param phoneNumber - Already canonical (`+94XXXXXXXXX`), from `updateGymPhoneSchema`
 * @returns `ok` with the stored number, `taken`, or `error` (a write RLS
 *   refused matches no row and lands here, never as success)
 */
export async function updateGymPhone(
  gymId: string,
  phoneNumber: string
): Promise<UpdateGymPhoneResult> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('gyms')
    .update({
      phone_number: phoneNumber,
      updated_at: new Date().toISOString(),
    })
    .eq('id', gymId)
    .select('id, phone_number')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { status: 'taken' }
    }
    console.error('Update gym phone error:', error)
    return { status: 'error' }
  }

  return { status: 'ok', profile: data }
}

/** Active discount presets for the gym, ordered by name. Throws on failure. */
export async function getActiveDiscounts(
  gymId: string
): Promise<
  { id: string; discount_name: string; discount_percentage: number }[]
> {
  const supabase = await createClient()

  const { data: discounts, error } = await supabase
    .from('discounts')
    .select('id, discount_name, discount_percentage')
    .eq('gym_id', gymId)
    .eq('is_active', true)
    .order('discount_name')

  if (error) {
    console.error('Fetch discounts error:', error)
    throw error
  }

  return discounts || []
}

export interface DiscountRow {
  id: string
  discount_name: string
  discount_percentage: number
}

/** Batch discount lookup keyed by id (member-list serialization join). */
export async function getDiscountsByIds(
  ids: string[]
): Promise<Record<string, DiscountRow>> {
  if (ids.length === 0) return {}

  const supabase = await createClient()
  const { data: discounts } = await supabase
    .from('discounts')
    .select('id, discount_name, discount_percentage')
    .in('id', ids)

  if (!discounts) return {}

  return discounts.reduce(
    (acc, discount) => {
      acc[discount.id] = discount
      return acc
    },
    {} as Record<string, DiscountRow>
  )
}

/** Single discount lookup in the camelCase shape the registration/payment flows use. */
export async function getDiscountInfoById(id: string): Promise<{
  discountId: string
  discountName: string
  discountPercentage: number
} | null> {
  const supabase = await createClient()
  const { data: discountData } = await supabase
    .from('discounts')
    .select('id, discount_name, discount_percentage')
    .eq('id', id)
    .single()

  if (!discountData) return null

  return {
    discountId: discountData.id,
    discountName: discountData.discount_name,
    discountPercentage: discountData.discount_percentage,
  }
}
