import { query, transaction, setUserContext } from '@/lib/db/client'
import { AssignPlanInput } from '../schemas/memberships.schemas'
import { MemberMembership } from '../types'

/**
 * Assign plan to member
 */
export async function assignPlanToMember(
  userId: string,
  input: AssignPlanInput
): Promise<MemberMembership> {
  return transaction(async (client) => {
    // Set RLS context
    await setUserContext(client, userId)

    // Check member exists and get gym_id
    const memberResult = await client.query('SELECT gym_id, status FROM members WHERE id = $1', [
      input.memberId,
    ])

    if (memberResult.rowCount === 0) {
      throw new Error('Member not found')
    }

    const memberStatus = memberResult.rows[0].status
    if (memberStatus !== 'active' && memberStatus !== 'pending') {
      throw new Error('Member must be active or pending to assign a membership')
    }

    // Check plan exists and is active
    const planResult = await client.query(
      'SELECT billing_frequency, is_active FROM membership_plans WHERE id = $1',
      [input.planId]
    )

    if (planResult.rowCount === 0) {
      throw new Error('Plan not found')
    }

    const plan = planResult.rows[0]
    if (!plan.is_active) {
      throw new Error('Cannot assign an inactive plan')
    }

    // Calculate next billing date based on billing frequency
    let nextBillingDate: Date | null = null
    const startDate = new Date(input.startDate)
    const autoRenew = input.autoRenew ?? true

    if (plan.billing_frequency === 'monthly') {
      nextBillingDate = new Date(startDate)
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)
    } else if (plan.billing_frequency === 'annual') {
      nextBillingDate = new Date(startDate)
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1)
    }

    // Insert member membership with pending status
    const result = await client.query<MemberMembership>(
      `INSERT INTO member_memberships (member_id, plan_id, status, start_date, next_billing_date, auto_renew)
       VALUES ($1, $2, 'pending', $3, $4, $5)
       RETURNING
         id, member_id as "memberId", plan_id as "planId", status,
         start_date as "startDate", end_date as "endDate",
         next_billing_date as "nextBillingDate", auto_renew as "autoRenew",
         created_at as "createdAt", updated_at as "updatedAt"`,
      [input.memberId, input.planId, startDate, nextBillingDate, autoRenew]
    )

    return result.rows[0]
  })
}

/**
 * Get member's active membership
 */
export async function getMemberActiveMembership(
  memberId: string,
  userId: string
): Promise<MemberMembership | null> {
  const result = await query<MemberMembership>(
    `SELECT
       id, member_id as "memberId", plan_id as "planId", status,
       start_date as "startDate", end_date as "endDate",
       next_billing_date as "nextBillingDate", auto_renew as "autoRenew",
       created_at as "createdAt", updated_at as "updatedAt"
     FROM member_memberships
     WHERE member_id = $1 AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [memberId]
  )

  return result.rowCount && result.rowCount > 0 ? result.rows[0] : null
}

/**
 * Cancel membership
 */
export async function cancelMembership(
  membershipId: string,
  userId: string
): Promise<MemberMembership> {
  const result = await query<MemberMembership>(
    `UPDATE member_memberships
     SET status = 'cancelled', end_date = NOW()
     WHERE id = $1
     RETURNING
       id, member_id as "memberId", plan_id as "planId", status,
       start_date as "startDate", end_date as "endDate",
       next_billing_date as "nextBillingDate", auto_renew as "autoRenew",
       created_at as "createdAt", updated_at as "updatedAt"`,
    [membershipId]
  )

  if (result.rowCount === 0) {
    throw new Error('Membership not found')
  }

  return result.rows[0]
}

/**
 * Get member membership history
 */
export async function getMemberMembershipHistory(
  memberId: string,
  userId: string
): Promise<MemberMembership[]> {
  const result = await query<MemberMembership>(
    `SELECT
       id, member_id as "memberId", plan_id as "planId", status,
       start_date as "startDate", end_date as "endDate",
       next_billing_date as "nextBillingDate", auto_renew as "autoRenew",
       created_at as "createdAt", updated_at as "updatedAt"
     FROM member_memberships
     WHERE member_id = $1
     ORDER BY created_at DESC`,
    [memberId]
  )

  return result.rows
}
