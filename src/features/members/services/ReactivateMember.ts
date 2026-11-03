/**
 * Reactivate Member Use Case
 *
 * Reactivates a suspended or expired member by transitioning them back to active status.
 *
 * This use case orchestrates:
 * 1. Finding the member by ID
 * 2. Transitioning them to active status (state machine enforced)
 * 3. Persisting the update
 * 4. Returning the updated member
 *
 * Valid transitions:
 * - Expired → Active
 * - Suspended → Active
 */

import { Member } from '@/features/members/domain/Member';
import { IMemberRepository } from './IMemberRepository';
import { NotFoundError } from '@/utils/errors';
import { LIFECYCLE_FIELDS } from '@/features/members/config/MemberWriteFields';

/**
 * Input for reactivating a member
 */
export interface ReactivateMemberInput {
  /**
   * Member ID to reactivate
   */
  memberId: string;

  /**
   * Gym ID (for multi-tenant isolation)
   */
  gymId: string;

  /**
   * New due date for the reactivated membership
   */
  newDueDate: Date;
}

/**
 * Reactivate Member Use Case
 *
 * Reactivates a suspended or expired member, returning them to active status.
 *
 * @example
 * const reactivateMember = new ReactivateMember(memberRepository);
 * const activeMember = await reactivateMember.execute({
 *   memberId: 'member-123',
 *   gymId: 'gym-456',
 *   newDueDate: new Date('2026-04-27')
 * });
 */
export class ReactivateMember {
  constructor(private readonly memberRepo: IMemberRepository) {}

  /**
   * Execute member reactivation
   *
   * @param input - Reactivate member input
   * @returns Reactivated member
   * @throws NotFoundError if member not found
   * @throws InvalidStatusTransitionError if transition not allowed
   */
  async execute(input: ReactivateMemberInput): Promise<Member> {
    const { memberId, gymId, newDueDate } = input;

    // Find the member
    const member = await this.memberRepo.findById(memberId, gymId);

    if (!member) {
      throw new NotFoundError(`Member with ID ${memberId} not found`);
    }

    // Activate the member (state machine validates the transition)
    const activatedMember = member.activate(newDueDate);

    // Persist the update
    // Status and due date only: the member was read above, so writing the whole
    // row would revert anything edited meanwhile.
    const saved = await this.memberRepo.updateFields(
      activatedMember,
      LIFECYCLE_FIELDS
    );

    return saved;
  }
}
