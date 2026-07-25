/**
 * Supabase Member Repository Implementation
 *
 * Implements IMemberRepository using Supabase as the data source.
 *
 * This is an ADAPTER in hexagonal architecture - it implements the port
 * defined by the core domain (IMemberRepository) using infrastructure (Supabase).
 *
 * Key responsibilities:
 * 1. Translate domain operations to Supabase queries
 * 2. Map database rows (snake_case) to domain entities (camelCase)
 * 3. Map domain entities back to database format for persistence
 * 4. Handle errors and return domain-appropriate error messages
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { Member } from '@/features/members/domain/Member'
import {
  IMemberRepository,
  type MemberFilters,
  type PaginatedResult,
} from '@/features/members/services/IMemberRepository'
import { PlanType } from '@/features/members/config/PlanConfig'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { RegistrationSource } from '@/features/members/config/RegistrationConfig'
import { NotFoundError, MemberLimitError, DatabaseError } from '@/utils/errors'

/**
 * Database row interface (snake_case from Supabase)
 */
interface MemberRow {
  id: string
  gym_id: string
  /** Per-gym sequential member ID. Optional so toDatabase() (write path) can
   *  omit it — assignment is owned by the DB trigger, never the app. */
  member_number?: number
  name: string
  phone_number: string
  plan_type: string
  plan_amount: number
  discount_id: string | null
  recurring_discount: boolean
  status: string
  registered_date: string
  membership_start_date: string
  next_due_date: string
  created_at: string
  updated_at: string
  photo_path: string | null
  photo_updated_at: string | null
  registration_source: string
  verified_at: string | null
  remarks: string | null
  accepted_terms_at: string | null
  accepted_gym_rules_at: string | null
  discount?: {
    id: string
    discount_name: string
    discount_percentage: number
  } | null
}

/**
 * Supabase Member Repository
 *
 * @example
 * const supabase = await createClient();
 * const memberRepo = new SupabaseMemberRepository(supabase);
 *
 * const member = await memberRepo.findById('member-123', 'gym-456');
 * const updatedMember = member.activate(new Date());
 * await memberRepo.update(updatedMember);
 */
export class SupabaseMemberRepository implements IMemberRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Find member by ID
   */
  async findById(id: string, gymId: string): Promise<Member | null> {
    const { data, error } = await this.supabase
      .from('members')
      .select('*')
      .eq('id', id)
      .eq('gym_id', gymId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null
      }
      throw new Error(`Failed to find member: ${error.message}`)
    }

    return data ? this.toDomain(data) : null
  }

  /**
   * Find all members with filters and pagination
   */
  async findAll(filters: MemberFilters): Promise<PaginatedResult<Member>> {
    const {
      gymId,
      search,
      status,
      planType,
      page = 1,
      limit = 50,
      sortBy = 'newest',
    } = filters

    // Build query with count and discount join
    let query = this.supabase
      .from('members')
      .select('*, discount:discounts(id, discount_name, discount_percentage)', {
        count: 'exact',
      })
      .eq('gym_id', gymId)

    // Apply filters — search by name, phone, or member ID (e.g. "0001" / "1")
    if (search) {
      const orFilters = [
        `name.ilike.%${search}%`,
        `phone_number.ilike.%${search}%`,
      ]
      const trimmed = search.trim()
      if (/^\d+$/.test(trimmed)) {
        // Strip leading zeros so "0001" matches member_number 1
        const asNumber = parseInt(trimmed, 10)
        if (Number.isSafeInteger(asNumber)) {
          orFilters.push(`member_number.eq.${asNumber}`)
        }
      }
      query = query.or(orFilters.join(','))
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (planType) {
      query = query.eq('plan_type', planType)
    }

    // Apply sorting
    switch (sortBy) {
      case 'oldest':
        query = query.order('created_at', { ascending: true })
        break
      case 'upcoming_due':
        query = query.order('next_due_date', { ascending: true })
        break
      case 'recently_expired':
        query = query
          .eq('status', MemberStatus.Expired)
          .order('updated_at', { ascending: false })
        break
      case 'name_asc':
        query = query.order('name', { ascending: true })
        break
      case 'name_desc':
        query = query.order('name', { ascending: false })
        break
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false })
        break
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch members: ${error.message}`)
    }

    const members = (data || []).map((row) => this.toDomain(row))
    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / limit)

    return {
      items: members,
      totalCount,
      page,
      totalPages,
    }
  }

  /**
   * Find all active members for a gym
   */
  async findActiveMembers(gymId: string): Promise<Member[]> {
    const { data, error } = await this.supabase
      .from('members')
      .select('*')
      .eq('gym_id', gymId)
      .eq('status', MemberStatus.Active)

    if (error) {
      throw new Error(`Failed to fetch active members: ${error.message}`)
    }

    return (data || []).map((row) => this.toDomain(row))
  }

  /**
   * Find all active members across all gyms
   */
  async findAllActiveMembers(): Promise<Member[]> {
    const { data, error } = await this.supabase
      .from('members')
      .select('*')
      .eq('status', MemberStatus.Active)

    if (error) {
      throw new Error(`Failed to fetch all active members: ${error.message}`)
    }

    return (data || []).map((row) => this.toDomain(row))
  }

  /**
   * Find all expired members for a gym
   */
  async findExpiredMembers(gymId: string): Promise<Member[]> {
    const { data, error } = await this.supabase
      .from('members')
      .select('*')
      .eq('gym_id', gymId)
      .eq('status', MemberStatus.Expired)

    if (error) {
      throw new Error(`Failed to fetch expired members: ${error.message}`)
    }

    return (data || []).map((row) => this.toDomain(row))
  }

  /**
   * Find all expired members across all gyms
   */
  async findAllExpiredMembers(): Promise<Member[]> {
    const { data, error } = await this.supabase
      .from('members')
      .select('*')
      .eq('status', MemberStatus.Expired)

    if (error) {
      throw new Error(`Failed to fetch all expired members: ${error.message}`)
    }

    return (data || []).map((row) => this.toDomain(row))
  }

  /**
   * Find all suspended members across all gyms
   */
  async findAllSuspendedMembers(): Promise<Member[]> {
    const { data, error } = await this.supabase
      .from('members')
      .select('*')
      .eq('status', MemberStatus.Suspended)

    if (error) {
      throw new Error(`Failed to fetch all suspended members: ${error.message}`)
    }

    return (data || []).map((row) => this.toDomain(row))
  }

  /**
   * Find overdue members (active but past due date)
   */
  async findOverdueMembers(gymId: string): Promise<Member[]> {
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await this.supabase
      .from('members')
      .select('*')
      .eq('gym_id', gymId)
      .eq('status', MemberStatus.Active)
      .lt('next_due_date', today)

    if (error) {
      throw new Error(`Failed to fetch overdue members: ${error.message}`)
    }

    return (data || []).map((row) => this.toDomain(row))
  }

  /**
   * Find members due within N days
   */
  async findMembersDueWithinDays(
    gymId: string,
    days: number
  ): Promise<Member[]> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const futureDate = new Date(today)
    futureDate.setDate(futureDate.getDate() + days)

    const todayStr = today.toISOString().split('T')[0]
    const futureDateStr = futureDate.toISOString().split('T')[0]

    const { data, error } = await this.supabase
      .from('members')
      .select('*')
      .eq('gym_id', gymId)
      .eq('status', MemberStatus.Active)
      .gte('next_due_date', todayStr)
      .lte('next_due_date', futureDateStr)

    if (error) {
      throw new Error(
        `Failed to fetch members due within ${days} days: ${error.message}`
      )
    }

    return (data || []).map((row) => this.toDomain(row))
  }

  /**
   * Create a new member
   */
  async create(member: Member): Promise<Member> {
    const row = this.toDatabase(member)

    // Remove id, created_at, updated_at - these are auto-generated
    const {
      id: _id,
      created_at: _createdAt,
      updated_at: _updatedAt,
      ...insertData
    } = row

    const { data, error } = await this.supabase
      .from('members')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create member: ${error.message}`)
    }

    return this.toDomain(data)
  }

  /**
   * Create a member through the FOR UPDATE-locked quota gate.
   *
   * The register_member_guarded RPC (migration 20260704000003) locks the
   * gyms row, applies the tier allowance matrix, and performs the INSERT in
   * one transaction — the single member-quota authority. EXECUTE is granted
   * to service_role only, so this repo must be constructed with the admin
   * client on registration paths (the route authenticates and pins gymId
   * BEFORE this call).
   */
  async createGuarded(gymId: string, member: Member): Promise<Member> {
    const row = this.toDatabase(member)
    const pMember = {
      name: row.name,
      phone_number: row.phone_number,
      plan_type: row.plan_type,
      plan_amount: row.plan_amount,
      discount_id: row.discount_id,
      recurring_discount: row.recurring_discount,
      status: row.status,
      registered_date: row.registered_date,
      membership_start_date: row.membership_start_date,
      next_due_date: row.next_due_date,
      remarks: row.remarks,
      accepted_terms_at: row.accepted_terms_at,
      accepted_gym_rules_at: row.accepted_gym_rules_at,
    }

    const { data, error } = await this.supabase.rpc('register_member_guarded', {
      p_gym_id: gymId,
      p_member: pMember,
    })

    if (error) {
      if (error.message.includes('MEMBER_LIMIT_REACHED')) {
        throw new MemberLimitError()
      }
      if (error.message.includes('GYM_NOT_FOUND')) {
        throw new NotFoundError('Gym')
      }
      throw new DatabaseError(`Failed to register member: ${error.message}`)
    }

    const created = await this.findById(data as string, gymId)
    if (!created) {
      throw new DatabaseError('Member created but could not be loaded')
    }
    return created
  }

  /**
   * Update an existing member
   *
   * Into-active status flips (reactivation, payment collection on an expired
   * member) are quota-gated by the DB trigger trg_enforce_active_member_quota
   * (migration 20260708000001) — at the cap it raises MEMBER_LIMIT_REACHED,
   * surfaced here as MemberLimitError so routes can return the 403 the UI
   * keys its upgrade prompt on.
   */
  async update(member: Member): Promise<Member> {
    const row = this.toDatabase(member)

    // Remove created_at - it should never be updated
    const { created_at: _createdAt, ...updateData } = row

    // Ensure updated_at is set to now
    updateData.updated_at = new Date().toISOString()

    const { data, error } = await this.supabase
      .from('members')
      .update(updateData)
      .eq('id', member.id)
      .eq('gym_id', member.gymId)
      .select()
      .single()

    if (error) {
      if (error.message.includes('MEMBER_LIMIT_REACHED')) {
        throw new MemberLimitError()
      }
      throw new Error(`Failed to update member: ${error.message}`)
    }

    if (!data) {
      throw new NotFoundError(`Member ${member.id}`)
    }

    return this.toDomain(data)
  }

  /**
   * Delete a member
   */
  async delete(id: string, gymId: string): Promise<void> {
    const { error } = await this.supabase
      .from('members')
      .delete()
      .eq('id', id)
      .eq('gym_id', gymId)

    if (error) {
      throw new Error(`Failed to delete member: ${error.message}`)
    }
  }

  /**
   * Update status for multiple members (batch operation)
   */
  async updateStatusBatch(
    memberIds: string[],
    status: MemberStatus,
    gymId: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('members')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .in('id', memberIds)
      .eq('gym_id', gymId)

    if (error) {
      // Batch into-active flips hit the same DB quota gate as single updates
      if (error.message.includes('MEMBER_LIMIT_REACHED')) {
        throw new MemberLimitError()
      }
      throw new Error(`Failed to batch update member status: ${error.message}`)
    }
  }

  /**
   * Count members by status
   */
  async countByStatus(gymId: string): Promise<Record<MemberStatus, number>> {
    const { data, error } = await this.supabase
      .from('members')
      .select('status')
      .eq('gym_id', gymId)

    if (error) {
      throw new Error(`Failed to count members by status: ${error.message}`)
    }

    // Initialize all statuses to 0
    const counts: Record<MemberStatus, number> = {
      [MemberStatus.Active]: 0,
      [MemberStatus.Expired]: 0,
      [MemberStatus.Cancelled]: 0,
      [MemberStatus.Suspended]: 0,
    }

    // Count each status
    ;(data || []).forEach((row) => {
      const status = row.status as MemberStatus
      if (status in counts) {
        counts[status]++
      }
    })

    return counts
  }

  /**
   * Count members by plan type
   */
  async countByPlanType(gymId: string): Promise<Record<PlanType, number>> {
    const { data, error } = await this.supabase
      .from('members')
      .select('plan_type')
      .eq('gym_id', gymId)

    if (error) {
      throw new Error(`Failed to count members by plan type: ${error.message}`)
    }

    // Initialize all plan types to 0
    const counts: Record<PlanType, number> = {
      [PlanType.Daily]: 0,
      [PlanType.Weekly]: 0,
      [PlanType.Monthly]: 0,
      [PlanType.ThreeMonths]: 0,
      [PlanType.SixMonths]: 0,
      [PlanType.Annual]: 0,
      [PlanType.Custom]: 0,
    }

    // Count each plan type
    ;(data || []).forEach((row) => {
      const planType = row.plan_type as PlanType
      if (planType in counts) {
        counts[planType]++
      }
    })

    return counts
  }

  /**
   * Find member by phone number
   */
  async findByPhoneNumber(
    phoneNumber: string,
    gymId: string
  ): Promise<Member | null> {
    const { data, error } = await this.supabase
      .from('members')
      .select('*')
      .eq('gym_id', gymId)
      .eq('phone_number', phoneNumber)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null
      }
      throw new Error(`Failed to find member by phone number: ${error.message}`)
    }

    return data ? this.toDomain(data) : null
  }

  // ============================================================
  // MAPPING METHODS (Private)
  // ============================================================

  /**
   * Map database row to domain entity
   *
   * This is where we translate snake_case database fields to camelCase domain properties.
   *
   * @param row - Database row
   * @returns Domain Member entity
   */
  private toDomain(row: MemberRow): Member {
    return Member.fromDatabase({
      id: row.id,
      gymId: row.gym_id,
      memberNumber: row.member_number ?? null,
      name: row.name,
      phoneNumber: row.phone_number,
      planType: row.plan_type as PlanType,
      planAmount: row.plan_amount,
      discountId: row.discount_id,
      recurringDiscount: row.recurring_discount,
      status: row.status as MemberStatus,
      registeredDate: new Date(row.registered_date),
      membershipStartDate: new Date(row.membership_start_date),
      nextDueDate: new Date(row.next_due_date),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      photoPath: row.photo_path ?? null,
      photoUpdatedAt: row.photo_updated_at
        ? new Date(row.photo_updated_at)
        : null,
      registrationSource:
        (row.registration_source as RegistrationSource) ??
        RegistrationSource.Manual,
      verifiedAt: row.verified_at ? new Date(row.verified_at) : null,
      remarks: row.remarks ?? null,
      acceptedTermsAt: row.accepted_terms_at
        ? new Date(row.accepted_terms_at)
        : null,
      acceptedGymRulesAt: row.accepted_gym_rules_at
        ? new Date(row.accepted_gym_rules_at)
        : null,
    })
  }

  /**
   * Map domain entity to database row
   *
   * This is where we translate camelCase domain properties to snake_case database fields.
   *
   * @param member - Domain Member entity
   * @returns Database row
   */
  private toDatabase(member: Member): MemberRow {
    const props = member.toDatabase()

    return {
      id: props.id,
      gym_id: props.gymId,
      name: props.name,
      phone_number: props.phoneNumber,
      plan_type: props.planType,
      plan_amount: props.planAmount,
      discount_id: props.discountId,
      recurring_discount: props.recurringDiscount,
      status: props.status,
      registered_date: props.registeredDate.toISOString().split('T')[0],
      membership_start_date: props.membershipStartDate
        .toISOString()
        .split('T')[0],
      next_due_date: props.nextDueDate.toISOString().split('T')[0],
      created_at: props.createdAt.toISOString(),
      updated_at: props.updatedAt.toISOString(),
      photo_path: props.photoPath ?? null,
      photo_updated_at: props.photoUpdatedAt?.toISOString() ?? null,
      registration_source:
        props.registrationSource ?? RegistrationSource.Manual,
      verified_at: props.verifiedAt?.toISOString() ?? null,
      remarks: props.remarks ?? null,
      accepted_terms_at: props.acceptedTermsAt?.toISOString() ?? null,
      accepted_gym_rules_at: props.acceptedGymRulesAt?.toISOString() ?? null,
    }
  }
}
