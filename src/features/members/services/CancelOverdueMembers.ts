/**
 * Cancel Overdue Members Use Case
 *
 * Cancels expired members who are overdue by 14+ days.
 *
 * Extracted from: src/features/sms/services/reminder.service.ts (lines 375-430)
 *
 * This use case orchestrates:
 * 1. Finding expired members whose next_due_date is 14+ days in the past
 * 2. Transitioning them to cancelled status (state machine enforced)
 * 3. Persisting the updates
 * 4. Returning summary of cancellations
 *
 * This is typically run as a daily cron job.
 */

import { Member } from '@/features/members/domain/Member'
import { IMemberRepository } from './IMemberRepository'
import { MEMBER_CANCELLATION_OVERDUE_DAYS } from '@/features/members/config/StatusConfig'
import { STATUS_FIELDS } from '@/features/members/config/MemberWriteFields'
import { ConflictError } from '@/utils/errors'

/**
 * Summary of cancellations
 */
export interface CancelOverdueMembersSummary {
  /**
   * Total members cancelled
   */
  totalCancelled: number

  /**
   * Members that were cancelled
   */
  cancelledMembers: {
    id: string
    name: string
    nextDueDate: Date
    daysOverdue: number
  }[]

  /**
   * Errors encountered
   */
  errors: string[]

  /**
   * Members left alone because they changed while this job was running (paid,
   * reactivated, suspended): their status or due date no longer matched what
   * this job read, so writing would have reverted the change. Not an error.
   */
  skippedChanged: number
}

/**
 * Cancel Overdue Members Use Case
 *
 * Automatically cancels expired members who are significantly overdue.
 *
 * Business Rule: If a member is 14+ days past next_due_date without payment,
 * their status should be changed from 'expired' to 'cancelled'.
 *
 * This helps clean up the database and identifies truly inactive members.
 *
 * @example
 * const cancelOverdue = new CancelOverdueMembers(memberRepository);
 * const summary = await cancelOverdue.execute();
 * console.log(`Cancelled ${summary.totalCancelled} members`);
 *
 * @example
 * // With custom threshold
 * const cancelOverdue = new CancelOverdueMembers(memberRepository);
 * const summary = await cancelOverdue.execute({ overdueDays: 30 });
 */
export class CancelOverdueMembers {
  constructor(private readonly memberRepo: IMemberRepository) {}

  /**
   * Execute member cancellation
   *
   * @param options - Optional configuration
   * @param options.overdueDays - Number of days overdue before cancellation (default: 14)
   * @returns Summary of cancellations
   */
  async execute(options?: {
    overdueDays?: number
  }): Promise<CancelOverdueMembersSummary> {
    const overdueDays = options?.overdueDays ?? MEMBER_CANCELLATION_OVERDUE_DAYS

    const summary: CancelOverdueMembersSummary = {
      totalCancelled: 0,
      cancelledMembers: [],
      errors: [],
      skippedChanged: 0,
    }

    try {
      console.log(`🔄 Checking for members overdue by ${overdueDays}+ days...`)

      // Calculate cutoff date
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const cutoffDate = new Date(today)
      cutoffDate.setDate(cutoffDate.getDate() - overdueDays)

      console.log(`  Cutoff date: ${this.formatDate(cutoffDate)}`)

      // Find all expired members across all gyms (paged in the repository)
      const expiredMembers = await this.getAllExpiredMembersAcrossGyms()

      // Filter members whose next_due_date is at or before the cutoff.
      // Inclusive (`<=`): a member exactly `overdueDays` past due IS cancelled
      // on this run — "passed 14 days" means 14 full days overdue, not 15.
      const severelyOverdueMembers = expiredMembers.filter((member) => {
        const dueDate = new Date(member.nextDueDate)
        dueDate.setHours(0, 0, 0, 0)
        return dueDate <= cutoffDate
      })

      console.log(`  Found ${severelyOverdueMembers.length} members to cancel`)

      // Cancel each severely overdue member
      for (const member of severelyOverdueMembers) {
        try {
          // Calculate days overdue for logging
          const daysOverdue = this.calculateDaysOverdue(
            member.nextDueDate,
            today
          )

          // Use state machine to transition to cancelled
          const cancelledMember = member.cancel()

          // Persist the status only, and only if the member is still expired
          // and still due on the date this run read. The list was read once, up
          // front; a payment recorded since would otherwise be reverted by
          // writing back what was read.
          await this.memberRepo.updateFields(cancelledMember, STATUS_FIELDS, {
            expectedStatus: member.status,
            expectedNextDueDate: member.nextDueDate,
          })

          // Add to summary
          summary.totalCancelled++
          summary.cancelledMembers.push({
            id: member.id,
            name: member.name,
            nextDueDate: member.nextDueDate,
            daysOverdue,
          })

          console.log(
            `  - Cancelled: ${member.name} (was due: ${this.formatDate(member.nextDueDate)}, ${daysOverdue} days overdue)`
          )
        } catch (error) {
          if (error instanceof ConflictError) {
            summary.skippedChanged++
            console.log(`  - Skipped: ${member.name} changed while this ran`)
            continue
          }
          const errorMsg = `Failed to cancel member ${member.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          summary.errors.push(errorMsg)
          console.error(`  ✗ ${errorMsg}`)
        }
      }

      if (summary.totalCancelled > 0) {
        console.log(
          `✅ Cancelled ${summary.totalCancelled} member(s) overdue by ${overdueDays}+ days`
        )
      } else {
        console.log('✓ No members need cancellation')
      }
    } catch (error) {
      const errorMsg = `Fatal error in CancelOverdueMembers: ${error instanceof Error ? error.message : 'Unknown error'}`
      summary.errors.push(errorMsg)
      console.error(errorMsg)
    }

    return summary
  }

  /**
   * Get all expired members across all gyms
   *
   * @returns Array of expired members
   */
  private async getAllExpiredMembersAcrossGyms(): Promise<Member[]> {
    return await this.memberRepo.findAllExpiredMembers()
  }

  /**
   * Calculate days overdue
   *
   * @param dueDate - Original due date
   * @param today - Current date
   * @returns Number of days overdue
   */
  private calculateDaysOverdue(dueDate: Date, today: Date): number {
    const due = new Date(dueDate)
    due.setHours(0, 0, 0, 0)
    const current = new Date(today)
    current.setHours(0, 0, 0, 0)

    const diffMs = current.getTime() - due.getTime()
    return Math.floor(diffMs / (1000 * 60 * 60 * 24))
  }

  /**
   * Format date for display
   *
   * @param date - Date to format
   * @returns Formatted date string (YYYY-MM-DD)
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]
  }
}
