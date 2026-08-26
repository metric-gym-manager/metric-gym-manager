/**
 * What the front desk sees about one member's door access.
 *
 * ## Two rules shape every field here
 *
 * **Pending is not failure (rule 2.8).** A member whose change has not reached
 * the reader yet is in progress. Showing that as an error trains staff to
 * distrust the screen, and the change usually lands seconds later anyway.
 *
 * **Gym managers never see vendor detail (rule 2.9).** The explanation is
 * plain language derived from our own decision — "Membership payment is
 * overdue" — not a return code, HTTP status or stack trace. The raw truth
 * lives on the SaaS-admin health view.
 *
 * The verdict itself comes from the same `resolveAccessDecision` the sync path
 * uses, so the screen cannot disagree with the door about *why*.
 */

import type { IAccessControlRepository } from './IAccessControlRepository'
import {
  describeAccessDenial,
  resolveAccessDecision,
} from '@/features/access-control/domain/AccessDecision'
import {
  formatDeviceDate,
  getGymToday,
} from '@/features/access-control/utils/getGymToday'
import type { MemberAccessStatus } from '@/features/access-control/types'

export class GetMemberAccessStatus {
  constructor(private readonly repo: IAccessControlRepository) {}

  /**
   * Resolve one member's access state.
   *
   * @param gymId - Owning gym, checked against the member's own.
   * @param memberId - Member to describe.
   * @param today - Gym-local calendar day. Injectable for tests.
   * @returns The sanitized status, or `null` if the member is not this gym's.
   */
  async execute(
    gymId: string,
    memberId: string,
    today: Date = getGymToday()
  ): Promise<MemberAccessStatus | null> {
    const context = await this.repo.getMemberAccessContext(memberId)
    if (!context || context.gymId !== gymId) return null

    const decision = resolveAccessDecision({
      status: context.status,
      membershipStartDate: context.membershipStartDate,
      nextDueDate: context.nextDueDate,
      registrationSource: context.registrationSource,
      verifiedAt: context.verifiedAt,
      today,
    })

    const [pending, dead] = await Promise.all([
      this.repo.countPendingJobs(memberId),
      this.repo.countDeadJobs(memberId),
    ])

    return {
      memberId: context.memberId,
      subjectId: context.subject?.subject_id ?? null,
      allowed: decision.allowed,
      explanation: decision.allowed
        ? 'Access is active'
        : describeAccessDenial(decision.reason),
      fingerEnrolled: context.subject?.finger_enrolled ?? false,
      validFrom: decision.validFrom
        ? formatDeviceDate(decision.validFrom)
        : null,
      validTo: decision.validTo ? formatDeviceDate(decision.validTo) : null,
      syncPending: pending > 0,
      syncFailed: dead > 0,
    }
  }
}
