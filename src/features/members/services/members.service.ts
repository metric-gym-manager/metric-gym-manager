import { query, transaction, setUserContext } from '@/lib/db/client'
import {
  CreateMemberInput,
  UpdateMemberInput,
  EmergencyContactInput,
  MedicalWaiverInput,
  MemberStatus,
} from '../schemas/members.schemas'
import { Member, EmergencyContact } from '../types'

/**
 * Create a new member
 */
export async function createMember(
  gymId: string,
  userId: string,
  input: CreateMemberInput
): Promise<Member> {
  return transaction(async (client) => {
    // Set RLS context
    await setUserContext(client, userId)

    // Check if email already exists in this gym
    const existing = await client.query(
      'SELECT id FROM members WHERE gym_id = $1 AND email = $2',
      [gymId, input.email]
    )

    if (existing.rowCount && existing.rowCount > 0) {
      throw new Error('Member with this email already exists in this gym')
    }

    // Insert member
    const result = await client.query<Member>(
      `INSERT INTO members (
        gym_id, email, first_name, last_name, phone, date_of_birth,
        gender, address, photo_url, notes, status
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
       RETURNING
         id, gym_id as "gymId", email, first_name as "firstName",
         last_name as "lastName", phone, date_of_birth as "dateOfBirth",
         gender, address, photo_url as "photoUrl", status, notes,
         created_at as "createdAt", updated_at as "updatedAt"`,
      [
        gymId,
        input.email,
        input.firstName,
        input.lastName,
        input.phone || null,
        input.dateOfBirth || null,
        input.gender || null,
        input.address ? JSON.stringify(input.address) : null,
        input.photoUrl || null,
        input.notes || null,
      ]
    )

    return result.rows[0]
  })
}

/**
 * Get member by ID
 */
export async function getMemberById(memberId: string, userId: string): Promise<Member | null> {
  const result = await query<Member>(
    `SELECT
       id, gym_id as "gymId", email, first_name as "firstName",
       last_name as "lastName", phone, date_of_birth as "dateOfBirth",
       gender, address, photo_url as "photoUrl", status, notes,
       created_at as "createdAt", updated_at as "updatedAt"
     FROM members
     WHERE id = $1`,
    [memberId]
  )

  return result.rowCount && result.rowCount > 0 ? result.rows[0] : null
}

/**
 * List members for a gym
 */
export async function listMembers(
  gymId: string,
  userId: string,
  filters?: {
    status?: MemberStatus
    search?: string
    limit?: number
    offset?: number
  }
): Promise<{ members: Member[]; total: number }> {
  let queryText = `
    SELECT
      id, gym_id as "gymId", email, first_name as "firstName",
      last_name as "lastName", phone, date_of_birth as "dateOfBirth",
      gender, address, photo_url as "photoUrl", status, notes,
      created_at as "createdAt", updated_at as "updatedAt"
    FROM members
    WHERE gym_id = $1
  `

  const params: any[] = [gymId]
  let paramIndex = 2

  if (filters?.status) {
    queryText += ` AND status = $${paramIndex}`
    params.push(filters.status)
    paramIndex++
  }

  if (filters?.search) {
    queryText += ` AND (
      first_name ILIKE $${paramIndex} OR
      last_name ILIKE $${paramIndex} OR
      email ILIKE $${paramIndex}
    )`
    params.push(`%${filters.search}%`)
    paramIndex++
  }

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as count FROM (${queryText}) as subquery`,
    params
  )
  const total = parseInt(countResult.rows[0].count)

  // Add pagination
  queryText += ` ORDER BY created_at DESC`

  if (filters?.limit) {
    queryText += ` LIMIT $${paramIndex}`
    params.push(filters.limit)
    paramIndex++
  }

  if (filters?.offset) {
    queryText += ` OFFSET $${paramIndex}`
    params.push(filters.offset)
  }

  const result = await query<Member>(queryText, params)

  return {
    members: result.rows,
    total,
  }
}

/**
 * Update member
 */
export async function updateMember(
  memberId: string,
  userId: string,
  input: UpdateMemberInput
): Promise<Member> {
  const updates: string[] = []
  const params: any[] = []
  let paramIndex = 1

  // Build dynamic update query
  if (input.email !== undefined) {
    updates.push(`email = $${paramIndex}`)
    params.push(input.email)
    paramIndex++
  }

  if (input.firstName !== undefined) {
    updates.push(`first_name = $${paramIndex}`)
    params.push(input.firstName)
    paramIndex++
  }

  if (input.lastName !== undefined) {
    updates.push(`last_name = $${paramIndex}`)
    params.push(input.lastName)
    paramIndex++
  }

  if (input.phone !== undefined) {
    updates.push(`phone = $${paramIndex}`)
    params.push(input.phone)
    paramIndex++
  }

  if (input.dateOfBirth !== undefined) {
    updates.push(`date_of_birth = $${paramIndex}`)
    params.push(input.dateOfBirth)
    paramIndex++
  }

  if (input.gender !== undefined) {
    updates.push(`gender = $${paramIndex}`)
    params.push(input.gender)
    paramIndex++
  }

  if (input.address !== undefined) {
    updates.push(`address = $${paramIndex}`)
    params.push(JSON.stringify(input.address))
    paramIndex++
  }

  if (input.photoUrl !== undefined) {
    updates.push(`photo_url = $${paramIndex}`)
    params.push(input.photoUrl)
    paramIndex++
  }

  if (input.notes !== undefined) {
    updates.push(`notes = $${paramIndex}`)
    params.push(input.notes)
    paramIndex++
  }

  if (updates.length === 0) {
    throw new Error('No fields to update')
  }

  params.push(memberId)

  const result = await query<Member>(
    `UPDATE members
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING
       id, gym_id as "gymId", email, first_name as "firstName",
       last_name as "lastName", phone, date_of_birth as "dateOfBirth",
       gender, address, photo_url as "photoUrl", status, notes,
       created_at as "createdAt", updated_at as "updatedAt"`,
    params
  )

  if (result.rowCount === 0) {
    throw new Error('Member not found')
  }

  return result.rows[0]
}

/**
 * Update member status
 */
export async function updateMemberStatus(
  memberId: string,
  userId: string,
  status: MemberStatus
): Promise<Member> {
  const result = await query<Member>(
    `UPDATE members
     SET status = $1
     WHERE id = $2
     RETURNING
       id, gym_id as "gymId", email, first_name as "firstName",
       last_name as "lastName", phone, date_of_birth as "dateOfBirth",
       gender, address, photo_url as "photoUrl", status, notes,
       created_at as "createdAt", updated_at as "updatedAt"`,
    [status, memberId]
  )

  if (result.rowCount === 0) {
    throw new Error('Member not found')
  }

  return result.rows[0]
}

/**
 * Add emergency contact
 */
export async function addEmergencyContact(
  memberId: string,
  userId: string,
  input: EmergencyContactInput
): Promise<EmergencyContact> {
  return transaction(async (client) => {
    const isPrimary = input.isPrimary ?? false

    // If this is marked as primary, unset other primary contacts
    if (isPrimary) {
      await client.query('UPDATE emergency_contacts SET is_primary = false WHERE member_id = $1', [
        memberId,
      ])
    }

    const result = await client.query<EmergencyContact>(
      `INSERT INTO emergency_contacts (member_id, name, relationship, phone, email, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING
         id, member_id as "memberId", name, relationship, phone, email,
         is_primary as "isPrimary", created_at as "createdAt", updated_at as "updatedAt"`,
      [memberId, input.name, input.relationship, input.phone, input.email || null, isPrimary]
    )

    return result.rows[0]
  })
}

/**
 * Get emergency contacts for member
 */
export async function getEmergencyContacts(
  memberId: string,
  userId: string
): Promise<EmergencyContact[]> {
  const result = await query<EmergencyContact>(
    `SELECT
       id, member_id as "memberId", name, relationship, phone, email,
       is_primary as "isPrimary", created_at as "createdAt", updated_at as "updatedAt"
     FROM emergency_contacts
     WHERE member_id = $1
     ORDER BY is_primary DESC, created_at ASC`,
    [memberId]
  )

  return result.rows
}

/**
 * Sign medical waiver
 */
export async function signMedicalWaiver(
  memberId: string,
  userId: string,
  input: MedicalWaiverInput
): Promise<void> {
  await query(
    `INSERT INTO medical_waivers (member_id, conditions, medications, allergies, signature_data, signed_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
      memberId,
      input.conditions || null,
      input.medications || null,
      input.allergies || null,
      input.signatureData,
    ]
  )
}
