import { createClient } from '@/lib/supabase/server'
import {
  CreateMemberInput,
  UpdateMemberInput,
  EmergencyContactInput,
  MedicalWaiverInput,
  MemberStatus,
} from '../schemas/members.schemas'
import { Member, EmergencyContact } from '../types'

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

type EmergencyContactRow = {
  id: string
  member_id: string
  name: string
  relationship: string
  phone: string
  email: string | null
  is_primary: boolean
  created_at: string
  updated_at: string
}

type MedicalWaiverRow = {
  id: string
  member_id: string
  conditions: string | null
  medications: string | null
  allergies: string | null
  signature_data: string
  signed_at: string
  created_at: string
  updated_at: string
}

// Custom error classes
export class ConflictError extends Error {
  statusCode = 409
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

export class NotFoundError extends Error {
  statusCode = 404
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

/**
 * Create a new member
 */
export async function createMember(
  gymId: string,
  userId: string,
  input: CreateMemberInput
): Promise<Member> {
  const supabase = await createClient()

  // Check for duplicate email
  const { data: existing } = await supabase
    .from('members')
    .select('id')
    .eq('gym_id', gymId)
    .eq('email', input.email)
    .maybeSingle<Pick<MemberRow, 'id'>>()

  if (existing) {
    throw new ConflictError('Member with this email already exists in this gym')
  }

  // Insert member
  const { data: member, error } = await supabase
    .from('members')
    .insert({
      gym_id: gymId,
      email: input.email,
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone || null,
      date_of_birth: input.dateOfBirth || null,
      gender: input.gender || null,
      address: (input.address as any) || null,
      photo_url: input.photoUrl || null,
      notes: input.notes || null,
      status: 'pending' as const,
    } as any)
    .select()
    .single<MemberRow>()

  if (error) throw error
  if (!member) throw new Error('Failed to create member')

  return {
    id: member.id,
    gymId: member.gym_id,
    email: member.email,
    firstName: member.first_name,
    lastName: member.last_name,
    phone: member.phone || undefined,
    dateOfBirth: member.date_of_birth ? new Date(member.date_of_birth) : undefined,
    gender: member.gender || undefined,
    address: member.address as any,
    photoUrl: member.photo_url || undefined,
    status: member.status as Member['status'],
    notes: member.notes || undefined,
    createdAt: new Date(member.created_at),
    updatedAt: new Date(member.updated_at),
  }
}

/**
 * Get member by ID
 */
export async function getMemberById(memberId: string): Promise<Member | null> {
  const supabase = await createClient()

  const { data: member, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', memberId)
    .maybeSingle<MemberRow>()

  if (error) throw error
  if (!member) return null

  return {
    id: member.id,
    gymId: member.gym_id,
    email: member.email,
    firstName: member.first_name,
    lastName: member.last_name,
    phone: member.phone || undefined,
    dateOfBirth: member.date_of_birth ? new Date(member.date_of_birth) : undefined,
    gender: member.gender || undefined,
    address: member.address as any,
    photoUrl: member.photo_url || undefined,
    status: member.status as Member['status'],
    notes: member.notes || undefined,
    createdAt: new Date(member.created_at),
    updatedAt: new Date(member.updated_at),
  }
}

/**
 * List members for a gym
 */
export async function listMembers(
  gymId: string,
  filters?: {
    status?: MemberStatus
    search?: string
    limit?: number
    offset?: number
  }
): Promise<{ members: Member[]; total: number }> {
  const supabase = await createClient()

  // Build query with filters
  let query = supabase
    .from('members')
    .select('*', { count: 'exact' })
    .eq('gym_id', gymId)

  // Apply filters dynamically
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.search) {
    query = query.or(
      `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
    )
  }

  // Order by created_at DESC
  query = query.order('created_at', { ascending: false })

  // Pagination
  if (filters?.limit && filters?.offset) {
    const limit = filters.limit
    query = query.range(filters.offset, filters.offset + limit - 1)
  } else if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error, count } = await query.returns<MemberRow[]>()

  if (error) throw error

  const members = (data || []).map((m: any) => ({
    id: m.id,
    gymId: m.gym_id,
    email: m.email,
    firstName: m.first_name,
    lastName: m.last_name,
    phone: m.phone || undefined,
    dateOfBirth: m.date_of_birth ? new Date(m.date_of_birth) : undefined,
    gender: m.gender || undefined,
    address: m.address as any,
    photoUrl: m.photo_url || undefined,
    status: m.status as Member['status'],
    notes: m.notes || undefined,
    createdAt: new Date(m.created_at),
    updatedAt: new Date(m.updated_at),
  }))

  return {
    members,
    total: count || 0,
  }
}

/**
 * Update member
 */
export async function updateMember(
  memberId: string,
  input: UpdateMemberInput
): Promise<Member> {
  const supabase = await createClient()

  // Build update object with only provided fields
  const updates: any = {}
  if (input.email !== undefined) updates.email = input.email
  if (input.firstName !== undefined) updates.first_name = input.firstName
  if (input.lastName !== undefined) updates.last_name = input.lastName
  if (input.phone !== undefined) updates.phone = input.phone
  if (input.dateOfBirth !== undefined) updates.date_of_birth = input.dateOfBirth
  if (input.gender !== undefined) updates.gender = input.gender
  if (input.address !== undefined) updates.address = input.address as any
  if (input.photoUrl !== undefined) updates.photo_url = input.photoUrl
  if (input.notes !== undefined) updates.notes = input.notes

  if (Object.keys(updates).length === 0) {
    throw new Error('No fields to update')
  }

  const { data: member, error } = await supabase
    .from('members')
    .update(updates)
    .eq('id', memberId)
    .select()
    .single<MemberRow>()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError('Member not found')
    }
    throw error
  }

  return {
    id: member.id,
    gymId: member.gym_id,
    email: member.email,
    firstName: member.first_name,
    lastName: member.last_name,
    phone: member.phone || undefined,
    dateOfBirth: member.date_of_birth ? new Date(member.date_of_birth) : undefined,
    gender: member.gender || undefined,
    address: member.address as any,
    photoUrl: member.photo_url || undefined,
    status: member.status as Member['status'],
    notes: member.notes || undefined,
    createdAt: new Date(member.created_at),
    updatedAt: new Date(member.updated_at),
  }
}

/**
 * Update member status
 */
export async function updateMemberStatus(
  memberId: string,
  status: MemberStatus
): Promise<Member> {
  const supabase = await createClient()

  const { data: member, error } = await supabase
    .from('members')
    .update({ status })
    .eq('id', memberId)
    .select()
    .single<MemberRow>()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError('Member not found')
    }
    throw error
  }

  return {
    id: member.id,
    gymId: member.gym_id,
    email: member.email,
    firstName: member.first_name,
    lastName: member.last_name,
    phone: member.phone || undefined,
    dateOfBirth: member.date_of_birth ? new Date(member.date_of_birth) : undefined,
    gender: member.gender || undefined,
    address: member.address as any,
    photoUrl: member.photo_url || undefined,
    status: member.status as Member['status'],
    notes: member.notes || undefined,
    createdAt: new Date(member.created_at),
    updatedAt: new Date(member.updated_at),
  }
}

/**
 * Add emergency contact
 */
export async function addEmergencyContact(
  memberId: string,
  input: EmergencyContactInput
): Promise<EmergencyContact> {
  const supabase = await createClient()
  const isPrimary = input.isPrimary ?? false

  // If this is marked as primary, unset other primary contacts
  if (isPrimary) {
    await supabase
      .from('emergency_contacts')
      .update({ is_primary: false })
      .eq('member_id', memberId)
  }

  const { data: contact, error } = await supabase
    .from('emergency_contacts')
    .insert({
      member_id: memberId,
      name: input.name,
      relationship: input.relationship,
      phone: input.phone,
      email: input.email || null,
      is_primary: isPrimary,
    } as any)
    .select()
    .single<EmergencyContactRow>()

  if (error) throw error

  return {
    id: contact.id,
    memberId: contact.member_id,
    name: contact.name,
    relationship: contact.relationship,
    phone: contact.phone,
    email: contact.email || undefined,
    isPrimary: contact.is_primary,
    createdAt: new Date(contact.created_at),
    updatedAt: new Date(contact.updated_at),
  }
}

/**
 * Get emergency contacts for member
 */
export async function getEmergencyContacts(
  memberId: string
): Promise<EmergencyContact[]> {
  const supabase = await createClient()

  const { data: contacts, error } = await supabase
    .from('emergency_contacts')
    .select('*')
    .eq('member_id', memberId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
    .returns<EmergencyContactRow[]>()

  if (error) throw error

  return (contacts || []).map((c: any) => ({
    id: c.id,
    memberId: c.member_id,
    name: c.name,
    relationship: c.relationship,
    phone: c.phone,
    email: c.email || undefined,
    isPrimary: c.is_primary,
    createdAt: new Date(c.created_at),
    updatedAt: new Date(c.updated_at),
  }))
}

/**
 * Sign medical waiver
 */
export async function signMedicalWaiver(
  memberId: string,
  input: MedicalWaiverInput
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase.from('medical_waivers').insert({
    member_id: memberId,
    conditions: input.conditions || null,
    medications: input.medications || null,
    allergies: input.allergies || null,
    signature_data: input.signatureData,
    signed_at: new Date().toISOString(),
  } as any)

  if (error) throw error
}
