/**
 * Verify Member Use Case
 *
 * Marks a QR self-registered member as verified by the front desk.
 *
 * QR self-registrations are created directly as active members (with welcome
 * SMS and payment record) to keep the flow under a minute. The NEW badge in
 * the members table lets the gym audit the entry afterwards; this use case
 * clears it.
 *
 * Idempotent: verifying an already-verified or manually registered member is
 * a no-op that returns the member unchanged.
 */

import { Member } from '@/features/members/domain/Member';
import { IMemberRepository } from '@/core/ports/repositories';
import { NotFoundError } from '@/utils/errors';

/**
 * Input for verifying a member
 */
export interface VerifyMemberInput {
  /**
   * Member ID to verify
   */
  memberId: string;

  /**
   * Gym ID (for multi-tenant isolation)
   */
  gymId: string;
}

/**
 * Verify Member Use Case
 *
 * @example
 * const verifyMember = new VerifyMember(memberRepository);
 * const verified = await verifyMember.execute({
 *   memberId: 'member-123',
 *   gymId: 'gym-456'
 * });
 */
export class VerifyMember {
  constructor(private readonly memberRepo: IMemberRepository) {}

  /**
   * Execute member verification
   *
   * @param input - Verify member input
   * @returns Verified member
   * @throws NotFoundError if member not found
   */
  async execute(input: VerifyMemberInput): Promise<Member> {
    const { memberId, gymId } = input;

    const member = await this.memberRepo.findById(memberId, gymId);

    if (!member) {
      throw new NotFoundError(`Member with ID ${memberId} not found`);
    }

    // No-op when the member is already verified (or was registered manually)
    if (!member.needsVerification()) {
      return member;
    }

    const verifiedMember = member.verify();

    return this.memberRepo.update(verifiedMember);
  }
}
