/**
 * Member Repository Interface (Port)
 *
 * Defines the contract for member data access.
 * This is a PORT in hexagonal architecture - the core defines what it needs,
 * and infrastructure provides the implementation.
 *
 * CRITICAL: This interface must NOT contain any infrastructure details
 * (no Supabase, no SQL, no database-specific logic).
 */

import { Member } from '@/features/members/domain/Member'
import { PlanType } from '@/features/members/config/PlanConfig'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import type { MemberWritableField } from '@/features/members/config/MemberWriteFields'

/**
 * What a gym owner reads when a guarded write is refused (409). The screens
 * that show it reload the member themselves, so it asks for a check, not a
 * reload, and it names no machinery.
 */
export const MEMBER_CHANGED_MESSAGE =
  'Someone else changed this member just now. Check their details and try again.'

/**
 * Conditions a member write applies under: each names a value the caller read,
 * and the write lands only if the stored member still has it.
 */
export interface MemberWriteGuard {
  /** Stored `next_due_date` must still equal this. */
  expectedNextDueDate?: Date
  /** Stored `status` must still equal this. */
  expectedStatus?: MemberStatus
  /** Stored `plan_type` and `plan_amount` must still equal these. */
  expectedPlan?: { planType: PlanType; planAmount: number }
}

/**
 * Member query filters
 */
export interface MemberFilters {
  /**
   * Gym ID (required for multi-tenancy)
   */
  gymId: string

  /**
   * Search by name or phone number
   */
  search?: string

  /**
   * Filter by status
   */
  status?: MemberStatus

  /**
   * Filter by plan type
   */
  planType?: PlanType

  /**
   * Pagination: page number (1-indexed)
   */
  page?: number

  /**
   * Pagination: items per page
   */
  limit?: number

  /**
   * Sorting option
   */
  sortBy?:
    | 'newest'
    | 'oldest'
    | 'upcoming_due'
    | 'recently_expired'
    | 'name_asc'
    | 'name_desc'
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  items: T[]
  totalCount: number
  page: number
  totalPages: number
}

/**
 * Member Repository Interface
 *
 * This defines all data access operations for members.
 * Infrastructure layer will implement this interface using Supabase.
 *
 * @example
 * // Use in a use case
 * class RegisterMember {
 *   constructor(private memberRepo: IMemberRepository) {}
 *
 *   async execute(data: RegisterMemberInput) {
 *     const member = Member.create(data);
 *     return await this.memberRepo.create(member);
 *   }
 * }
 */
export interface IMemberRepository {
  /**
   * Find member by ID
   *
   * @param id - Member ID
   * @param gymId - Gym ID (for RLS enforcement)
   * @returns Member if found, null otherwise
   */
  findById(id: string, gymId: string): Promise<Member | null>

  /**
   * Find all members with filters and pagination
   *
   * @param filters - Query filters
   * @returns Paginated list of members
   */
  findAll(filters: MemberFilters): Promise<PaginatedResult<Member>>

  /**
   * Find all active members for a gym
   *
   * Used by reminder cron job to send automated reminders.
   *
   * @param gymId - Gym ID
   * @returns Array of active members
   */
  findActiveMembers(gymId: string): Promise<Member[]>

  /**
   * Find all active members across all gyms
   *
   * Used by reminder cron job when processing all gyms.
   *
   * @returns Array of active members from all gyms
   */
  findAllActiveMembers(): Promise<Member[]>

  /**
   * Find all expired members for a gym
   *
   * Used by status update cron job.
   *
   * @param gymId - Gym ID
   * @returns Array of expired members
   */
  findExpiredMembers(gymId: string): Promise<Member[]>

  /**
   * Find all expired members across all gyms
   *
   * Used by cancellation cron job when processing all gyms.
   *
   * @returns Array of expired members from all gyms
   */
  findAllExpiredMembers(): Promise<Member[]>

  /**
   * Find all suspended members across all gyms
   *
   * Used by expire-suspended-members cron job when processing all gyms.
   *
   * @returns Array of suspended members from all gyms
   */
  findAllSuspendedMembers(): Promise<Member[]>

  /**
   * Find overdue members (active but past due date)
   *
   * Used for displaying overdue sidebar and expired status updates.
   *
   * @param gymId - Gym ID
   * @returns Array of overdue members
   */
  findOverdueMembers(gymId: string): Promise<Member[]>

  /**
   * Find members due within N days
   *
   * Used for payment reminders and upcoming dues.
   *
   * @param gymId - Gym ID
   * @param days - Number of days
   * @returns Array of members due within specified days
   */
  findMembersDueWithinDays(gymId: string, days: number): Promise<Member[]>

  /**
   * Create a new member
   *
   * @param member - Member entity to create
   * @returns Created member with assigned ID
   */
  create(member: Member): Promise<Member>

  /**
   * Create a new member through the FOR UPDATE-locked quota gate
   * (register_member_guarded RPC — the single member-quota authority).
   *
   * Requires a service-role client; the API layer authenticates the caller
   * and pins gymId before invoking.
   *
   * @param gymId - JWT-derived gym id (per-tenant mutex row)
   * @param member - Member entity to create
   * @returns Created member with assigned ID
   * @throws MemberLimitError when the subscription tier blocks the insert
   * @throws NotFoundError when the gym does not exist
   */
  createGuarded(gymId: string, member: Member): Promise<Member>

  /**
   * Write the named fields of a member, and nothing else.
   *
   * There is deliberately no "write the whole member". A writer reads a
   * member, changes one to three columns and used to write all ~22 back, so
   * anything another request changed in between was put back: a payment
   * reverted a profile edit, and a nightly cron reverted a payment recorded
   * while it ran. Name the fields from `MemberWriteFields` instead.
   *
   * @param member - Member carrying the new values for `fields`. Its other
   *   values may be stale and are never written.
   * @param fields - The fields to write, e.g. `LIFECYCLE_FIELDS`.
   * @param options.expectedNextDueDate - Apply only if the stored
   *   `next_due_date` still equals this. Payment collection passes it so two
   *   concurrent submissions cannot both advance the same member; the crons
   *   pass it so a member paid mid-run is skipped, not reverted.
   * @param options.expectedStatus - Apply only if the stored `status` still
   *   equals this. The crons pass it so a status change made mid-run wins;
   *   suspend, cancel and reactivate pass it because each was chosen against
   *   the status the operator saw.
   * @param options.expectedPlan - Apply only if the stored plan type and
   *   amount still equal these. A payment that switches the plan passes it, so
   *   it cannot put its plan back over a plan edit saved after it read.
   * @returns The member as stored after the write (live values for every
   *   column this call did not write).
   * @throws ConflictError if a guard was given and no row matched.
   * @throws NotFoundError if no guard was given and no row matched (also what
   *   an RLS-refused write looks like, so it is never reported as success).
   * @throws MemberLimitError if the write is an into-active flip the gym's
   *   plan does not allow.
   */
  updateFields(
    member: Member,
    fields: readonly MemberWritableField[],
    options?: MemberWriteGuard
  ): Promise<Member>

  /**
   * Delete a member
   *
   * @param id - Member ID
   * @param gymId - Gym ID (for RLS enforcement)
   */
  delete(id: string, gymId: string): Promise<void>

  /**
   * Count members by status
   *
   * Used for dashboard statistics.
   *
   * @param gymId - Gym ID
   * @returns Count by status
   */
  countByStatus(gymId: string): Promise<Record<MemberStatus, number>>

  /**
   * Count members by plan type
   *
   * Used for dashboard analytics.
   *
   * @param gymId - Gym ID
   * @returns Count by plan type
   */
  countByPlanType(gymId: string): Promise<Record<PlanType, number>>

  /**
   * Find member by phone number
   *
   * Used for checking duplicates before registration.
   *
   * @param phoneNumber - Phone number to search
   * @param gymId - Gym ID
   * @returns Member if found, null otherwise
   */
  findByPhoneNumber(phoneNumber: string, gymId: string): Promise<Member | null>
}
