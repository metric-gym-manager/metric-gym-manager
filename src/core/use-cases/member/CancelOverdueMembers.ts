/**
 * Cancel Overdue Members Use Case
 *
 * Cancels expired members who are overdue by 45+ days.
 *
 * Extracted from: src/features/sms/services/reminder.service.ts (lines 375-430)
 *
 * This use case orchestrates:
 * 1. Finding expired members whose next_due_date is 45+ days in the past
 * 2. Transitioning them to cancelled status (state machine enforced)
 * 3. Persisting the updates
 * 4. Returning summary of cancellations
 *
 * This is typically run as a daily cron job.
 */

import { Member } from '@/core/domain/member/Member';
import { IMemberRepository } from '@/core/ports/repositories';

/**
 * Configuration for cancellation threshold
 */
const OVERDUE_THRESHOLD_DAYS = 45;

/**
 * Summary of cancellations
 */
export interface CancelOverdueMembersSummary {
  /**
   * Total members cancelled
   */
  totalCancelled: number;

  /**
   * Members that were cancelled
   */
  cancelledMembers: {
    id: string;
    name: string;
    nextDueDate: Date;
    daysOverdue: number;
  }[];

  /**
   * Errors encountered
   */
  errors: string[];
}

/**
 * Cancel Overdue Members Use Case
 *
 * Automatically cancels expired members who are significantly overdue.
 *
 * Business Rule: If a member has been expired for 45+ days without payment,
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
   * @param options.overdueDays - Number of days overdue before cancellation (default: 45)
   * @returns Summary of cancellations
   */
  async execute(options?: { overdueDays?: number }): Promise<CancelOverdueMembersSummary> {
    const overdueDays = options?.overdueDays ?? OVERDUE_THRESHOLD_DAYS;

    const summary: CancelOverdueMembersSummary = {
      totalCancelled: 0,
      cancelledMembers: [],
      errors: [],
    };

    try {
      console.log(`🔄 Checking for members overdue by ${overdueDays}+ days...`);

      // Calculate cutoff date
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const cutoffDate = new Date(today);
      cutoffDate.setDate(cutoffDate.getDate() - overdueDays);

      console.log(`  Cutoff date: ${this.formatDate(cutoffDate)}`);

      // Find all expired members across all gyms
      // TODO: Add findAllExpiredMembers() method to IMemberRepository
      const expiredMembers = await this.getAllExpiredMembersAcrossGyms();

      // Filter members whose next_due_date < cutoffDate
      const severelyOverdueMembers = expiredMembers.filter((member) => {
        const dueDate = new Date(member.nextDueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate < cutoffDate;
      });

      console.log(`  Found ${severelyOverdueMembers.length} members to cancel`);

      // Cancel each severely overdue member
      for (const member of severelyOverdueMembers) {
        try {
          // Calculate days overdue for logging
          const daysOverdue = this.calculateDaysOverdue(member.nextDueDate, today);

          // Use state machine to transition to cancelled
          const cancelledMember = member.cancel();

          // Persist update
          await this.memberRepo.update(cancelledMember);

          // Add to summary
          summary.totalCancelled++;
          summary.cancelledMembers.push({
            id: member.id,
            name: member.name,
            nextDueDate: member.nextDueDate,
            daysOverdue,
          });

          console.log(
            `  - Cancelled: ${member.name} (was due: ${this.formatDate(member.nextDueDate)}, ${daysOverdue} days overdue)`
          );
        } catch (error) {
          const errorMsg = `Failed to cancel member ${member.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          summary.errors.push(errorMsg);
          console.error(`  ✗ ${errorMsg}`);
        }
      }

      if (summary.totalCancelled > 0) {
        console.log(`✅ Cancelled ${summary.totalCancelled} member(s) overdue by ${overdueDays}+ days`);
      } else {
        console.log('✓ No members need cancellation');
      }
    } catch (error) {
      const errorMsg = `Fatal error in CancelOverdueMembers: ${error instanceof Error ? error.message : 'Unknown error'}`;
      summary.errors.push(errorMsg);
      console.error(errorMsg);
    }

    return summary;
  }

  /**
   * Get all expired members across all gyms
   *
   * @returns Array of expired members
   */
  private async getAllExpiredMembersAcrossGyms(): Promise<Member[]> {
    return await this.memberRepo.findAllExpiredMembers();
  }

  /**
   * Calculate days overdue
   *
   * @param dueDate - Original due date
   * @param today - Current date
   * @returns Number of days overdue
   */
  private calculateDaysOverdue(dueDate: Date, today: Date): number {
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const current = new Date(today);
    current.setHours(0, 0, 0, 0);

    const diffMs = current.getTime() - due.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Format date for display
   *
   * @param date - Date to format
   * @returns Formatted date string (YYYY-MM-DD)
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
