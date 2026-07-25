/**
 * Member Domain Entity
 *
 * This is the core domain model for gym members.
 * It encapsulates member business logic and enforces business rules.
 *
 * CRITICAL: This entity is IMMUTABLE. All mutation methods return new instances.
 * This ensures thread-safety and makes state changes explicit.
 */

import { randomUUID } from 'crypto'
import { PlanType } from '@/features/members/config/PlanConfig'
import {
  MemberStatus,
  canTransition,
} from '@/features/members/config/StatusConfig'
import { RegistrationSource } from '@/features/members/config/RegistrationConfig'
import { getDaysUntilDue } from '@/features/members/utils/getDaysUntilDue'
import { InvalidStatusTransitionError, ValidationError } from '@/utils/errors'

// Re-export MemberStatus and RegistrationSource for consumers
export { MemberStatus } from '@/features/members/config/StatusConfig'
export { RegistrationSource } from '@/features/members/config/RegistrationConfig'

/**
 * Member properties interface
 */
export interface MemberProps {
  id: string
  gymId: string

  /**
   * Per-gym sequential member ID (1-based; first member of a gym = 1).
   * Assigned by the database on insert, so it is null for a freshly created,
   * not-yet-persisted entity and populated once reloaded from the database.
   * Displayed zero-padded (e.g. #0001).
   */
  memberNumber?: number | null

  name: string
  phoneNumber: string
  planType: PlanType
  planAmount: number
  discountId: string | null
  recurringDiscount: boolean
  status: MemberStatus

  /**
   * Registration date (when member signed up)
   *
   * This is the official registration timestamp for audit trail purposes.
   * It may be earlier than membershipStartDate for backdated memberships.
   *
   * @example
   * // Member registered on Jan 15, but data entered on Jan 20
   * registeredDate: new Date('2024-01-15')
   * membershipStartDate: new Date('2024-01-20')
   */
  registeredDate: Date

  /**
   * Membership start date (when billing period begins)
   *
   * This is when the member's subscription period starts. It can be:
   * - Same as registeredDate (normal registration)
   * - Later than registeredDate (deferred start)
   * - Earlier than today (backdated for offline registrations)
   */
  membershipStartDate: Date

  nextDueDate: Date
  createdAt: Date
  updatedAt: Date

  /**
   * R2 object key of the member's face photo (e.g. 'profiles/{id}.webp').
   * NULL when no photo has been uploaded. Optional for backward
   * compatibility; normalized to null in the constructor.
   */
  photoPath?: string | null

  /**
   * When the photo was last uploaded/replaced. Used as a CDN cache-busting
   * version parameter since replacements overwrite the same object key.
   */
  photoUpdatedAt?: Date | null

  /**
   * How the member was registered (manual desk form vs QR self-registration).
   * Defaults to Manual for backward compatibility.
   */
  registrationSource?: RegistrationSource

  /**
   * When the gym verified a QR self-registration. NULL for unverified QR
   * members (rendered as a NEW badge). Manual registrations are considered
   * verified by definition and keep this null.
   */
  verifiedAt?: Date | null

  /**
   * Free-text note captured on the manual (desk) registration form. NULL for
   * QR self-registrations and older members. Optional; normalized to null.
   */
  remarks?: string | null

  /**
   * When the member accepted Metric's privacy policy & terms of service at
   * registration. NULL for members created before consent capture existed.
   */
  acceptedTermsAt?: Date | null

  /**
   * When the member agreed to the gym's guidelines & rules at registration.
   * NULL for members created before consent capture existed.
   */
  acceptedGymRulesAt?: Date | null
}

/**
 * Properties for creating a new member (without auto-generated fields)
 */
export type CreateMemberProps = Omit<
  MemberProps,
  'id' | 'createdAt' | 'updatedAt'
>

/**
 * Member domain entity
 *
 * This class represents a gym member with all business logic encapsulated.
 *
 * @example
 * // Create a new member
 * const member = Member.create({
 *   gymId: 'gym-123',
 *   name: 'John Doe',
 *   phoneNumber: '+94771234567',
 *   planType: PlanType.Monthly,
 *   planAmount: 2000,
 *   discountId: null,
 *   recurringDiscount: false,
 *   status: MemberStatus.Active,
 *   registeredDate: new Date(),
 *   membershipStartDate: new Date(),
 *   nextDueDate: new Date('2024-02-15')
 * });
 *
 * @example
 * // Check member status
 * if (member.isActive() && !member.isOverdue()) {
 *   console.log('Member can check in');
 * }
 *
 * @example
 * // Transition member status (immutable)
 * const expiredMember = member.expire();
 * const reactivatedMember = expiredMember.activate(new Date('2024-03-15'));
 */
export class Member {
  private readonly props: MemberProps

  private constructor(props: MemberProps) {
    // Validate required fields
    if (!props.gymId) throw new Error('gymId is required')
    if (!props.name || props.name.trim().length < 2) {
      throw new Error('name must be at least 2 characters')
    }
    if (!props.phoneNumber) throw new Error('phoneNumber is required')
    if (props.planAmount <= 0) throw new Error('planAmount must be positive')

    // Normalize optional fields so downstream code can rely on their presence
    this.props = {
      ...props,
      photoPath: props.photoPath ?? null,
      photoUpdatedAt: props.photoUpdatedAt ?? null,
      registrationSource: props.registrationSource ?? RegistrationSource.Manual,
      verifiedAt: props.verifiedAt ?? null,
      remarks: props.remarks ?? null,
      acceptedTermsAt: props.acceptedTermsAt ?? null,
      acceptedGymRulesAt: props.acceptedGymRulesAt ?? null,
    }
  }

  // ============================================================
  // FACTORY METHODS
  // ============================================================

  /**
   * Create a new member instance
   *
   * This is used when registering a new member.
   * ID, createdAt, and updatedAt will be assigned by the repository.
   *
   * @param props - Member creation properties
   * @returns New Member instance
   */
  static create(props: CreateMemberProps): Member {
    return new Member({
      ...props,
      id: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  /**
   * Reconstitute member from database
   *
   * This is used when loading existing members from the database.
   *
   * @param props - Complete member properties from database
   * @returns Member instance
   */
  static fromDatabase(props: MemberProps): Member {
    return new Member(props)
  }

  // ============================================================
  // GETTERS (Read-only access to properties)
  // ============================================================

  get id(): string {
    return this.props.id
  }

  get gymId(): string {
    return this.props.gymId
  }

  /**
   * Per-gym sequential member ID. Null until the entity has been persisted and
   * reloaded (the database assigns it on insert).
   */
  get memberNumber(): number | null {
    return this.props.memberNumber ?? null
  }

  get name(): string {
    return this.props.name
  }

  get phoneNumber(): string {
    return this.props.phoneNumber
  }

  get planType(): PlanType {
    return this.props.planType
  }

  get planAmount(): number {
    return this.props.planAmount
  }

  get discountId(): string | null {
    return this.props.discountId
  }

  get recurringDiscount(): boolean {
    return this.props.recurringDiscount
  }

  get status(): MemberStatus {
    return this.props.status
  }

  get membershipStartDate(): Date {
    return this.props.membershipStartDate
  }

  get nextDueDate(): Date {
    return this.props.nextDueDate
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date {
    return this.props.updatedAt
  }

  /**
   * Get registration date
   *
   * This is when the member officially registered (immutable audit timestamp).
   * May be earlier than membershipStartDate for backdated memberships.
   */
  get registeredDate(): Date {
    return this.props.registeredDate
  }

  get photoPath(): string | null {
    return this.props.photoPath ?? null
  }

  get photoUpdatedAt(): Date | null {
    return this.props.photoUpdatedAt ?? null
  }

  get registrationSource(): RegistrationSource {
    return this.props.registrationSource ?? RegistrationSource.Manual
  }

  get verifiedAt(): Date | null {
    return this.props.verifiedAt ?? null
  }

  get remarks(): string | null {
    return this.props.remarks ?? null
  }

  get acceptedTermsAt(): Date | null {
    return this.props.acceptedTermsAt ?? null
  }

  get acceptedGymRulesAt(): Date | null {
    return this.props.acceptedGymRulesAt ?? null
  }

  // ============================================================
  // DOMAIN METHODS (Business logic queries)
  // ============================================================

  /**
   * Check if member is active
   *
   * @returns True if status is Active
   */
  isActive(): boolean {
    return this.props.status === MemberStatus.Active
  }

  /**
   * Check if member is expired
   *
   * @returns True if status is Expired
   */
  isExpired(): boolean {
    return this.props.status === MemberStatus.Expired
  }

  /**
   * Check if member is suspended
   *
   * @returns True if status is Suspended
   */
  isSuspended(): boolean {
    return this.props.status === MemberStatus.Suspended
  }

  /**
   * Check if member is cancelled
   *
   * @returns True if status is Cancelled
   */
  isCancelled(): boolean {
    return this.props.status === MemberStatus.Cancelled
  }

  /**
   * Check if member is overdue
   *
   * A member is overdue if today is past their next due date.
   *
   * @returns True if overdue
   */
  isOverdue(): boolean {
    return getDaysUntilDue(this.props.nextDueDate) < 0
  }

  /**
   * Check if member can check in to the gym
   *
   * Requirements:
   * - Status must be Active
   * - Not overdue
   *
   * @returns True if can check in
   */
  canCheckIn(): boolean {
    return this.isActive() && !this.isOverdue()
  }

  /**
   * Get days until next due date
   *
   * Positive: days until due
   * Zero: due today
   * Negative: days overdue
   *
   * @returns Number of days until due
   */
  getDaysUntilDue(): number {
    return getDaysUntilDue(this.props.nextDueDate)
  }

  /**
   * Check if member has a discount applied
   *
   * @returns True if discount is applied
   */
  hasDiscount(): boolean {
    return this.props.discountId !== null
  }

  /**
   * Check if member has recurring discount
   *
   * @returns True if recurring discount is enabled
   */
  hasRecurringDiscount(): boolean {
    return this.props.recurringDiscount && this.hasDiscount()
  }

  /**
   * Check if member has a photo
   *
   * @returns True if a photo path is set
   */
  hasPhoto(): boolean {
    return this.photoPath !== null
  }

  /**
   * Check if this member is an unverified QR self-registration.
   *
   * Manual registrations never need verification; QR registrations need it
   * until the gym taps "verify" (verified_at set). Rendered as a NEW badge.
   *
   * @returns True if the registration still needs front-desk verification
   */
  needsVerification(): boolean {
    return (
      this.registrationSource === RegistrationSource.Qr &&
      this.verifiedAt === null
    )
  }

  // ============================================================
  // STATE TRANSITION METHODS (Immutable mutations)
  // ============================================================

  /**
   * Activate member with new due date
   *
   * This is called when:
   * - Payment is collected (expired → active)
   * - Member is reactivated from suspended
   *
   * @param newDueDate - The new next due date
   * @returns New Member instance with Active status
   * @throws InvalidStatusTransitionError if transition not allowed
   */
  activate(newDueDate: Date): Member {
    if (!canTransition(this.props.status, MemberStatus.Active)) {
      throw new InvalidStatusTransitionError(
        this.props.status,
        MemberStatus.Active
      )
    }

    return new Member({
      ...this.props,
      status: MemberStatus.Active,
      nextDueDate: newDueDate,
      updatedAt: new Date(),
    })
  }

  /**
   * Renew member (early renewal)
   *
   * This extends an already active member's subscription by updating their next due date.
   * This is used when an active member pays early (before their current subscription expires).
   *
   * This is called when:
   * - Active member makes early payment
   * - Active member extends subscription before expiry
   *
   * @param newDueDate - The new next due date
   * @returns New Member instance with updated due date (status remains Active)
   * @throws InvalidStatusTransitionError if member is not Active
   *
   * @example
   * // Active member pays early on Jan 15 (current due date: Jan 31)
   * // New due date becomes Feb 15 (30 days from payment date)
   * const renewed = member.renew(new Date('2024-02-15'));
   */
  renew(newDueDate: Date): Member {
    // Existing status validation
    if (this.props.status !== MemberStatus.Active) {
      throw new InvalidStatusTransitionError(
        this.props.status,
        MemberStatus.Active
      )
    }

    // NEW: Validate date is a valid Date object
    if (!(newDueDate instanceof Date) || isNaN(newDueDate.getTime())) {
      throw new ValidationError('newDueDate must be a valid Date object')
    }

    // NEW: Validate date is not in the past (compared to today at 00:00:00)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const newDueDateNormalized = new Date(newDueDate)
    newDueDateNormalized.setHours(0, 0, 0, 0)

    if (newDueDateNormalized < today) {
      throw new ValidationError('newDueDate must be in the future')
    }

    // NEW: Validate date is not before current due date (prevent backwards renewal)
    const currentDueDateNormalized = new Date(this.props.nextDueDate)
    currentDueDateNormalized.setHours(0, 0, 0, 0)

    if (newDueDateNormalized < currentDueDateNormalized) {
      throw new ValidationError('newDueDate must be after current due date')
    }

    // Create new instance with updated date
    return new Member({
      ...this.props,
      nextDueDate: newDueDate,
      updatedAt: new Date(),
    })
  }

  /**
   * Expire member
   *
   * This is called automatically by the system when payment is overdue.
   *
   * @returns New Member instance with Expired status
   * @throws InvalidStatusTransitionError if transition not allowed
   */
  expire(): Member {
    if (!canTransition(this.props.status, MemberStatus.Expired)) {
      throw new InvalidStatusTransitionError(
        this.props.status,
        MemberStatus.Expired
      )
    }

    return new Member({
      ...this.props,
      status: MemberStatus.Expired,
      updatedAt: new Date(),
    })
  }

  /**
   * Cancel member
   *
   * This is a permanent action. Cancelled members cannot be reactivated.
   *
   * @returns New Member instance with Cancelled status
   * @throws InvalidStatusTransitionError if transition not allowed
   */
  cancel(): Member {
    if (!canTransition(this.props.status, MemberStatus.Cancelled)) {
      throw new InvalidStatusTransitionError(
        this.props.status,
        MemberStatus.Cancelled
      )
    }

    return new Member({
      ...this.props,
      status: MemberStatus.Cancelled,
      updatedAt: new Date(),
    })
  }

  /**
   * Suspend member
   *
   * This is a temporary suspension for policy violations.
   *
   * @returns New Member instance with Suspended status
   * @throws InvalidStatusTransitionError if transition not allowed
   */
  suspend(): Member {
    if (!canTransition(this.props.status, MemberStatus.Suspended)) {
      throw new InvalidStatusTransitionError(
        this.props.status,
        MemberStatus.Suspended
      )
    }

    return new Member({
      ...this.props,
      status: MemberStatus.Suspended,
      updatedAt: new Date(),
    })
  }

  // ============================================================
  // UPDATE METHODS (Immutable mutations)
  // ============================================================

  /**
   * Update next due date
   *
   * This is called after payment collection.
   *
   * @param newDueDate - The new next due date
   * @returns New Member instance with updated due date
   */
  updateNextDueDate(newDueDate: Date): Member {
    return new Member({
      ...this.props,
      nextDueDate: newDueDate,
      updatedAt: new Date(),
    })
  }

  /**
   * Update plan details
   *
   * This is called when member changes their plan.
   *
   * @param planType - New plan type
   * @param planAmount - New plan amount
   * @returns New Member instance with updated plan
   */
  updatePlan(planType: PlanType, planAmount: number): Member {
    if (planAmount <= 0) {
      throw new Error('planAmount must be positive')
    }

    return new Member({
      ...this.props,
      planType,
      planAmount,
      updatedAt: new Date(),
    })
  }

  /**
   * Update discount
   *
   * @param discountId - Discount ID (null to remove)
   * @param recurringDiscount - Whether discount recurs
   * @returns New Member instance with updated discount
   */
  updateDiscount(
    discountId: string | null,
    recurringDiscount: boolean
  ): Member {
    return new Member({
      ...this.props,
      discountId,
      recurringDiscount,
      updatedAt: new Date(),
    })
  }

  /**
   * Update member name
   *
   * @param name - New name
   * @returns New Member instance with updated name
   */
  updateName(name: string): Member {
    if (!name || name.trim().length < 2) {
      throw new Error('name must be at least 2 characters')
    }

    return new Member({
      ...this.props,
      name: name.trim(),
      updatedAt: new Date(),
    })
  }

  /**
   * Update member phone number
   *
   * @param phoneNumber - New phone number
   * @returns New Member instance with updated phone
   */
  updatePhoneNumber(phoneNumber: string): Member {
    if (!phoneNumber) {
      throw new Error('phoneNumber is required')
    }

    return new Member({
      ...this.props,
      phoneNumber,
      updatedAt: new Date(),
    })
  }

  /**
   * Update plan type only
   *
   * @param planType - New plan type
   * @returns New Member instance with updated plan type
   */
  updatePlanType(planType: PlanType): Member {
    return new Member({
      ...this.props,
      planType,
      updatedAt: new Date(),
    })
  }

  /**
   * Update plan amount only
   *
   * @param planAmount - New plan amount
   * @returns New Member instance with updated plan amount
   */
  updatePlanAmount(planAmount: number): Member {
    if (planAmount <= 0) {
      throw new Error('planAmount must be positive')
    }

    return new Member({
      ...this.props,
      planAmount,
      updatedAt: new Date(),
    })
  }

  /**
   * Update recurring discount flag
   *
   * @param recurringDiscount - Whether discount recurs
   * @returns New Member instance with updated flag
   */
  updateRecurringDiscount(recurringDiscount: boolean): Member {
    return new Member({
      ...this.props,
      recurringDiscount,
      updatedAt: new Date(),
    })
  }

  /**
   * Update discount ID
   *
   * @param discountId - Discount ID (null to remove)
   * @returns New Member instance with updated discount
   */
  updateDiscountId(discountId: string | null): Member {
    return new Member({
      ...this.props,
      discountId,
      updatedAt: new Date(),
    })
  }

  /**
   * Set or replace the member's photo.
   *
   * photoUpdatedAt is refreshed so cached CDN copies of the overwritten
   * object key are busted via the ?v= query parameter.
   *
   * @param photoPath - R2 object key (e.g. 'profiles/{id}.webp')
   * @returns New Member instance with updated photo
   */
  updatePhoto(photoPath: string): Member {
    if (!photoPath || photoPath.trim().length === 0) {
      throw new ValidationError('photoPath is required')
    }

    return new Member({
      ...this.props,
      photoPath: photoPath.trim(),
      photoUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
  }

  /**
   * Remove the member's photo reference.
   *
   * The caller is responsible for deleting the underlying storage object.
   *
   * @returns New Member instance without photo
   */
  removePhoto(): Member {
    return new Member({
      ...this.props,
      photoPath: null,
      photoUpdatedAt: null,
      updatedAt: new Date(),
    })
  }

  /**
   * Verify a QR self-registration.
   *
   * Idempotent: verifying an already-verified or manually registered member
   * returns the same instance unchanged.
   *
   * @returns New Member instance with verifiedAt set
   */
  verify(): Member {
    if (!this.needsVerification()) {
      return this
    }

    return new Member({
      ...this.props,
      verifiedAt: new Date(),
      updatedAt: new Date(),
    })
  }

  // ============================================================
  // PERSISTENCE METHODS
  // ============================================================

  /**
   * Convert to database representation
   *
   * This is used by repositories when saving to database.
   *
   * @returns Member properties for database storage
   */
  toDatabase(): MemberProps {
    return { ...this.props }
  }

  /**
   * Create a copy with updated timestamp
   *
   * This is useful when you need to touch the updatedAt without other changes.
   *
   * @returns New Member instance with updated timestamp
   */
  touch(): Member {
    return new Member({
      ...this.props,
      updatedAt: new Date(),
    })
  }

  // ============================================================
  // UTILITY METHODS
  // ============================================================

  /**
   * Compare with another member
   *
   * @param other - Other member to compare
   * @returns True if same member (by ID)
   */
  equals(other: Member): boolean {
    return this.props.id === other.props.id
  }

  /**
   * Create a plain object representation (for logging/debugging)
   *
   * @returns Plain object with all properties
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      gymId: this.props.gymId,
      memberNumber: this.memberNumber,
      name: this.props.name,
      phoneNumber: this.props.phoneNumber,
      planType: this.props.planType,
      planAmount: this.props.planAmount,
      discountId: this.props.discountId,
      recurringDiscount: this.props.recurringDiscount,
      status: this.props.status,
      registeredDate: this.props.registeredDate.toISOString(),
      membershipStartDate: this.props.membershipStartDate.toISOString(),
      nextDueDate: this.props.nextDueDate.toISOString(),
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      photoPath: this.photoPath,
      photoUpdatedAt: this.photoUpdatedAt?.toISOString() ?? null,
      registrationSource: this.registrationSource,
      verifiedAt: this.verifiedAt?.toISOString() ?? null,
      remarks: this.remarks,
      acceptedTermsAt: this.acceptedTermsAt?.toISOString() ?? null,
      acceptedGymRulesAt: this.acceptedGymRulesAt?.toISOString() ?? null,
    }
  }
}
