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
 * - Expired → Cancelled — normally done by the `cancel-overdue-members` cron
 *   once a member is MEMBER_CANCELLATION_OVERDUE_DAYS (14) past their due date
 *   (StatusConfig.ts); this use case is the manual path.
 * - Suspended → Cancelled (permanent ban)
 *
 * Cancelled is not terminal: a cancelled member returns to Active through a
 * fresh payment (CollectPayment's reactivation; Cancelled → Active in
 * VALID_TRANSITIONS).
 */

import { Member } from '@/features/members/domain/Member'
import { IMemberRepository } from './IMemberRepository'
import { NotFoundError } from '@/utils/errors'
import { STATUS_FIELDS } from '@/features/members/config/MemberWriteFields'

/**
 * Input for cancelling a member
 */
export interface CancelMemberInput {
  /**
   * Member ID to cancel
   */
  memberId: string

  /**
   * Gym ID (for multi-tenant isolation)
   */
  gymId: string
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
    const { memberId, gymId } = input

    // Find the member
    const member = await this.memberRepo.findById(memberId, gymId)

    if (!member) {
      throw new NotFoundError(`Member with ID ${memberId} not found`)
    }

    // Cancel the member (state machine validates the transition)
    const cancelledMember = member.cancel()

    // Persist the update
    // Status only: the member was read above, so writing the whole row would
    // revert anything edited meanwhile.
    const saved = await this.memberRepo.updateFields(
      cancelledMember,
      STATUS_FIELDS
    )

    return saved
  }
}
