/**
 * Update Member Profile Use Case
 *
 * Applies an edit to a member's name, phone, plan, plan amount and discount.
 *
 * This use case orchestrates:
 * 1. Finding the member in the caller's gym
 * 2. Applying each supplied field through the entity (domain rules enforced)
 * 3. Refusing a phone number another member already holds
 * 4. Persisting ONLY the profile columns
 *
 * Status changes are not here: they have dedicated endpoints (suspend,
 * activate, cancel) so the state machine cannot be bypassed.
 */

import type { Member } from '@/features/members/domain/Member'
import type { PlanType } from '@/features/members/config/PlanConfig'
import { PhoneNumber } from '@/utils/phone/PhoneNumber'
import { ConflictError, NotFoundError } from '@/utils/errors'
import type { IMemberRepository } from './IMemberRepository'

/**
 * Fields an edit may change. Every one is optional: a field left out is left
 * alone, and `discountId: null` is the explicit "remove the discount".
 */
export interface UpdateMemberProfileInput {
  /** Member being edited. */
  memberId: string

  /** Gym ID (multi-tenant isolation; the member must belong to it). */
  gymId: string

  name?: string

  /** Already normalised to `+94XXXXXXXXX` by the request schema. */
  phoneNumber?: string

  planType?: PlanType
  planAmount?: number
  discountId?: string | null
  recurringDiscount?: boolean
}

export class UpdateMemberProfile {
  constructor(private readonly memberRepo: IMemberRepository) {}

  /**
   * Apply the edit.
   *
   * @param input - The member, the gym and the fields to change.
   * @returns The member as stored after the write.
   * @throws NotFoundError if the member does not exist in this gym.
   * @throws ConflictError if the new phone number belongs to another member.
   * @throws ValidationError if the phone number is not a valid Sri Lankan mobile.
   */
  async execute(input: UpdateMemberProfileInput): Promise<Member> {
    const { memberId, gymId } = input

    const member = await this.memberRepo.findById(memberId, gymId)
    if (!member) {
      throw new NotFoundError(`Member ${memberId}`)
    }

    // Only a CHANGED number is checked. The edit form resends the phone on
    // every save, and numbers that were shared before this check existed must
    // not lock their members out of every other edit.
    if (input.phoneNumber && input.phoneNumber !== member.phoneNumber) {
      const phone = PhoneNumber.create(input.phoneNumber)
      const holder = await this.memberRepo.findByPhoneNumber(
        phone.getValue(),
        gymId
      )

      if (holder && holder.id !== member.id) {
        throw new ConflictError(
          `A member with phone number ${phone.getDisplayValue()} already exists`
        )
      }
    }

    let updated = member
    if (input.name) updated = updated.updateName(input.name)
    if (input.phoneNumber)
      updated = updated.updatePhoneNumber(input.phoneNumber)
    if (input.planType) updated = updated.updatePlanType(input.planType)
    if (input.planAmount !== undefined) {
      updated = updated.updatePlanAmount(input.planAmount)
    }
    if (input.recurringDiscount !== undefined) {
      updated = updated.updateRecurringDiscount(input.recurringDiscount)
    }
    if (input.discountId !== undefined) {
      updated = updated.updateDiscountId(input.discountId)
    }

    return this.memberRepo.updateProfile(updated)
  }
}
