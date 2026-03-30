/**
 * Suspend Member Use Case
 *
 * Suspends an active member for policy violation or voluntary hold.
 *
 * This use case orchestrates:
 * 1. Finding the member by ID
 * 2. Transitioning them to suspended status (state machine enforced)
 * 3. Persisting the update
 * 4. Returning the updated member
 *
 * Valid transitions:
 * - Active → Suspended
 */

import { Member } from '@/core/domain/member/Member';
import { IMemberRepository } from '@/core/ports/repositories';
import { NotFoundError } from '@/core/utils/errors';

/**
 * Input for suspending a member
 */
export interface SuspendMemberInput {
  /**
   * Member ID to suspend
   */
  memberId: string;

  /**
   * Gym ID (for multi-tenant isolation)
   */
  gymId: string;
}

/**
 * Suspend Member Use Case
 *
 * Suspends a member for policy violation or voluntary membership hold.
 *
 * @example
 * const suspendMember = new SuspendMember(memberRepository);
 * const suspendedMember = await suspendMember.execute({
 *   memberId: 'member-123',
 *   gymId: 'gym-456'
 * });
 */
export class SuspendMember {
  constructor(private readonly memberRepo: IMemberRepository) {}

  /**
   * Execute member suspension
   *
   * @param input - Suspend member input
   * @returns Suspended member
   * @throws NotFoundError if member not found
   * @throws InvalidStatusTransitionError if transition not allowed
   */
  async execute(input: SuspendMemberInput): Promise<Member> {
    const { memberId, gymId } = input;

    // Find the member
    const member = await this.memberRepo.findById(memberId, gymId);

    if (!member) {
      throw new NotFoundError(`Member with ID ${memberId} not found`);
    }

    // Suspend the member (state machine validates the transition)
    const suspendedMember = member.suspend();

    // Persist the update
    const saved = await this.memberRepo.update(suspendedMember);

    return saved;
  }
}
