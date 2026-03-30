/**
 * Cancel Member Use Case
 *
 * Cancels a member's membership permanently, transitioning them to terminal cancelled status.
 *
 * This use case orchestrates:
 * 1. Finding the member by ID
 * 2. Transitioning them to cancelled status (state machine enforced)
 * 3. Persisting the update
 * 4. Returning the updated member
 *
 * Valid transitions:
 * - Expired → Cancelled (45+ days overdue)
 * - Suspended → Cancelled (permanent ban)
 *
 * Note: Cancelled is a terminal state with no outgoing transitions.
 */

import { Member } from '@/core/domain/member/Member';
import { IMemberRepository } from '@/core/ports/repositories';
import { NotFoundError } from '@/core/utils/errors';

/**
 * Input for cancelling a member
 */
export interface CancelMemberInput {
  /**
   * Member ID to cancel
   */
  memberId: string;

  /**
   * Gym ID (for multi-tenant isolation)
   */
  gymId: string;
}

/**
 * Cancel Member Use Case
 *
 * Permanently cancels a member's membership. This is an irreversible operation.
 *
 * @example
 * const cancelMember = new CancelMember(memberRepository);
 * const cancelledMember = await cancelMember.execute({
 *   memberId: 'member-123',
 *   gymId: 'gym-456'
 * });
 */
export class CancelMember {
  constructor(private readonly memberRepo: IMemberRepository) {}

  /**
   * Execute member cancellation
   *
   * @param input - Cancel member input
   * @returns Cancelled member
   * @throws NotFoundError if member not found
   * @throws InvalidStatusTransitionError if transition not allowed
   */
  async execute(input: CancelMemberInput): Promise<Member> {
    const { memberId, gymId } = input;

    // Find the member
    const member = await this.memberRepo.findById(memberId, gymId);

    if (!member) {
      throw new NotFoundError(`Member with ID ${memberId} not found`);
    }

    // Cancel the member (state machine validates the transition)
    const cancelledMember = member.cancel();

    // Persist the update
    const saved = await this.memberRepo.update(cancelledMember);

    return saved;
  }
}
