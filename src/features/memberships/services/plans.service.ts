import { query, transaction, setUserContext } from '@/lib/db/client'
import { CreatePlanInput, UpdatePlanInput } from '../schemas/memberships.schemas'
import { MembershipPlan } from '../types'

/**
 * Create a new membership plan
 */
export async function createPlan(
  gymId: string,
  userId: string,
  input: CreatePlanInput
): Promise<MembershipPlan> {
  return transaction(async (client) => {
    // Set RLS context
    await setUserContext(client, userId)

    const result = await client.query<MembershipPlan>(
      `INSERT INTO membership_plans (
        gym_id, name, description, plan_type, price_amount, billing_frequency,
        trial_days, access_level, class_credits, contract_length_months, setup_fee, is_active
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING
         id, gym_id as "gymId", name, description, plan_type as "planType",
         price_amount as "priceAmount", billing_frequency as "billingFrequency",
         trial_days as "trialDays", access_level as "accessLevel",
         class_credits as "classCredits", contract_length_months as "contractLengthMonths",
         setup_fee as "setupFee", is_active as "isActive",
         created_at as "createdAt", updated_at as "updatedAt"`,
      [
        gymId,
        input.name,
        input.description || null,
        input.planType,
        input.priceAmount,
        input.billingFrequency,
        input.trialDays ?? 0,
        input.accessLevel ?? 'business_hours',
        input.classCredits || null,
        input.contractLengthMonths || null,
        input.setupFee ?? 0,
        input.isActive ?? true,
      ]
    )

    return result.rows[0]
  })
}

/**
 * Get plan by ID
 */
export async function getPlanById(planId: string, userId: string): Promise<MembershipPlan | null> {
  const result = await query<MembershipPlan>(
    `SELECT
       id, gym_id as "gymId", name, description, plan_type as "planType",
       price_amount as "priceAmount", billing_frequency as "billingFrequency",
       trial_days as "trialDays", access_level as "accessLevel",
       class_credits as "classCredits", contract_length_months as "contractLengthMonths",
       setup_fee as "setupFee", is_active as "isActive",
       created_at as "createdAt", updated_at as "updatedAt"
     FROM membership_plans
     WHERE id = $1`,
    [planId]
  )

  return result.rowCount && result.rowCount > 0 ? result.rows[0] : null
}

/**
 * List plans for a gym
 */
export async function listPlans(
  gymId: string,
  userId: string,
  filters?: {
    planType?: string
    isActive?: boolean
  }
): Promise<MembershipPlan[]> {
  let queryText = `
    SELECT
      id, gym_id as "gymId", name, description, plan_type as "planType",
      price_amount as "priceAmount", billing_frequency as "billingFrequency",
      trial_days as "trialDays", access_level as "accessLevel",
      class_credits as "classCredits", contract_length_months as "contractLengthMonths",
      setup_fee as "setupFee", is_active as "isActive",
      created_at as "createdAt", updated_at as "updatedAt"
    FROM membership_plans
    WHERE gym_id = $1
  `

  const params: any[] = [gymId]
  let paramIndex = 2

  if (filters?.planType) {
    queryText += ` AND plan_type = $${paramIndex}`
    params.push(filters.planType)
    paramIndex++
  }

  if (filters?.isActive !== undefined) {
    queryText += ` AND is_active = $${paramIndex}`
    params.push(filters.isActive)
    paramIndex++
  }

  queryText += ` ORDER BY created_at DESC`

  const result = await query<MembershipPlan>(queryText, params)

  return result.rows
}

/**
 * Update plan
 */
export async function updatePlan(
  planId: string,
  userId: string,
  input: UpdatePlanInput
): Promise<MembershipPlan> {
  const updates: string[] = []
  const params: any[] = []
  let paramIndex = 1

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex}`)
    params.push(input.name)
    paramIndex++
  }

  if (input.description !== undefined) {
    updates.push(`description = $${paramIndex}`)
    params.push(input.description)
    paramIndex++
  }

  if (input.planType !== undefined) {
    updates.push(`plan_type = $${paramIndex}`)
    params.push(input.planType)
    paramIndex++
  }

  if (input.priceAmount !== undefined) {
    updates.push(`price_amount = $${paramIndex}`)
    params.push(input.priceAmount)
    paramIndex++
  }

  if (input.billingFrequency !== undefined) {
    updates.push(`billing_frequency = $${paramIndex}`)
    params.push(input.billingFrequency)
    paramIndex++
  }

  if (input.trialDays !== undefined) {
    updates.push(`trial_days = $${paramIndex}`)
    params.push(input.trialDays)
    paramIndex++
  }

  if (input.accessLevel !== undefined) {
    updates.push(`access_level = $${paramIndex}`)
    params.push(input.accessLevel)
    paramIndex++
  }

  if (input.classCredits !== undefined) {
    updates.push(`class_credits = $${paramIndex}`)
    params.push(input.classCredits)
    paramIndex++
  }

  if (input.contractLengthMonths !== undefined) {
    updates.push(`contract_length_months = $${paramIndex}`)
    params.push(input.contractLengthMonths)
    paramIndex++
  }

  if (input.setupFee !== undefined) {
    updates.push(`setup_fee = $${paramIndex}`)
    params.push(input.setupFee)
    paramIndex++
  }

  if (input.isActive !== undefined) {
    updates.push(`is_active = $${paramIndex}`)
    params.push(input.isActive)
    paramIndex++
  }

  if (updates.length === 0) {
    throw new Error('No fields to update')
  }

  params.push(planId)

  const result = await query<MembershipPlan>(
    `UPDATE membership_plans
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING
       id, gym_id as "gymId", name, description, plan_type as "planType",
       price_amount as "priceAmount", billing_frequency as "billingFrequency",
       trial_days as "trialDays", access_level as "accessLevel",
       class_credits as "classCredits", contract_length_months as "contractLengthMonths",
       setup_fee as "setupFee", is_active as "isActive",
       created_at as "createdAt", updated_at as "updatedAt"`,
    params
  )

  if (result.rowCount === 0) {
    throw new Error('Plan not found')
  }

  return result.rows[0]
}

/**
 * Deactivate plan
 */
export async function deactivatePlan(planId: string, userId: string): Promise<MembershipPlan> {
  const result = await query<MembershipPlan>(
    `UPDATE membership_plans
     SET is_active = false
     WHERE id = $1
     RETURNING
       id, gym_id as "gymId", name, description, plan_type as "planType",
       price_amount as "priceAmount", billing_frequency as "billingFrequency",
       trial_days as "trialDays", access_level as "accessLevel",
       class_credits as "classCredits", contract_length_months as "contractLengthMonths",
       setup_fee as "setupFee", is_active as "isActive",
       created_at as "createdAt", updated_at as "updatedAt"`,
    [planId]
  )

  if (result.rowCount === 0) {
    throw new Error('Plan not found')
  }

  return result.rows[0]
}
