/**
 * Update Expired Status Use Case
 *
 * Updates active members to expired status when their payment is overdue.
 *
 * Extracted from: src/features/sms/services/reminder.service.ts (lines 315-369)
 *
 * This use case orchestrates:
 * 1. Finding active members whose next_due_date has passed
 * 2. Transitioning them to expired status (state machine enforced)
 * 3. Persisting the updates
 * 4. Returning summary of updates
 *
 * This is typically run as a daily cron job.
 */

import { Member } from '@/features/members/domain/Member'
import { IMemberRepository } from './IMemberRepository'

/**
 * Summary of status updates
 */
export interface UpdateExpiredStatusSummary {
  /**
   * Total members updated to expired
   */
  totalUpdated: number

  /**
   * Members that were updated
   */
  updatedMembers: {
    id: string
    name: string
    nextDueDate: Date
  }[]

  /**
   * Errors encountered
   */
  errors: string[]
}

/**
 * Update Expired Status Use Case
 *
 * Automatically expires active members whose payment is overdue.
 *
 * Business Rule: There is NO grace period. As soon as a member's next_due_date
 * is in the past (`next_due_date < today`) and they haven't paid, their status
 * changes from 'active' to 'expired' — at which point they stop counting toward
 * the gym's active-member quota (the DB trigger decrements gyms.member_count).
 *
 * A member due *today* is still paid through today and stays Active; the very
 * next daily run expires them.
 *
 * @example
 * const updateExpired = new UpdateExpiredStatus(memberRepository);
 * const summary = await updateExpired.execute();
 * console.log(`Expired ${summary.totalUpdated} members`);
 */
export class UpdateExpiredStatus {
  constructor(private readonly memberRepo: IMemberRepository) {}

  /**
   * Execute status update
   *
   * @returns Summary of updates
   */
  async execute(): Promise<UpdateExpiredStatusSummary> {
    const summary: UpdateExpiredStatusSummary = {
      totalUpdated: 0,
      updatedMembers: [],
      errors: [],
    }

    try {
      console.log('🔄 Checking for expired members...')

      // Get today's date (00:00:00) to compare against due dates
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Fetch all active members (paged in the repository) and filter in memory.
      // TODO: Add findOverdueActiveMembers() to IMemberRepository so the due-date
      // predicate runs in the database rather than over the whole active set.
      const activeMembers = await this.getAllActiveMembersAcrossGyms()

      // Filter members whose next_due_date is in the past. No grace period:
      // strictly `< today`, so a member due today is untouched and a member due
      // yesterday expires on this run. Mirrors Member.isOverdue().
      const overdueMembers = activeMembers.filter((member) => {
        const dueDate = new Date(member.nextDueDate)
        dueDate.setHours(0, 0, 0, 0)
        return dueDate < today
      })

      console.log(`  Found ${overdueMembers.length} overdue members`)

      // Update each overdue member to expired status
      for (const member of overdueMembers) {
        try {
          // Use state machine to transition to expired
          const expiredMember = member.expire()

          // Persist update
          await this.memberRepo.update(expiredMember)

          // Add to summary
          summary.totalUpdated++
          summary.updatedMembers.push({
            id: member.id,
            name: member.name,
            nextDueDate: member.nextDueDate,
          })

          console.log(
            `  - Expired: ${member.name} (was due: ${this.formatDate(member.nextDueDate)})`
          )
        } catch (error) {
          const errorMsg = `Failed to expire member ${member.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          summary.errors.push(errorMsg)
          console.error(`  ✗ ${errorMsg}`)
        }
      }

      if (summary.totalUpdated > 0) {
        console.log(
          `✅ Updated ${summary.totalUpdated} member(s) to expired status`
        )
      } else {
        console.log('✓ No members need status update')
      }
    } catch (error) {
      const errorMsg = `Fatal error in UpdateExpiredStatus: ${error instanceof Error ? error.message : 'Unknown error'}`
      summary.errors.push(errorMsg)
      console.error(errorMsg)
    }

    return summary
  }

  /**
   * Get all active members across all gyms
   *
   * This is a temporary implementation until we add a more efficient
   * repository method for finding overdue active members.
   *
   * @returns Array of active members
   */
  private async getAllActiveMembersAcrossGyms(): Promise<Member[]> {
    // Use findAllActiveMembers() if available
    // This method was added to IMemberRepository in Phase 3.3
    return await this.memberRepo.findAllActiveMembers()
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
