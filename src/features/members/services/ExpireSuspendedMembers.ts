/**
 * Expire Suspended Members Use Case
 *
 * Expires suspended members when their next_due_date has passed.
 *
 * This use case orchestrates:
 * 1. Finding suspended members whose next_due_date has passed
 * 2. Transitioning them to expired status (state machine enforced)
 * 3. Persisting the updates
 * 4. Returning summary of updates
 *
 * Business Rule: If a suspended member's next_due_date has passed,
 * their status should transition from 'suspended' to 'expired'.
 *
 * Valid State Transition: Suspended → Expired
 *
 * This is typically run as a daily cron job.
 */

import { Member } from '@/features/members/domain/Member';
import { IMemberRepository } from './IMemberRepository';

/**
 * Summary of suspended member expirations
 */
export interface ExpireSuspendedMembersSummary {
  /**
   * Total members updated to expired
   */
  totalExpired: number;

  /**
   * Members that were expired
   */
  expiredMembers: {
    id: string;
    name: string;
    nextDueDate: Date;
  }[];

  /**
   * Errors encountered
   */
  errors: string[];
}

/**
 * Expire Suspended Members Use Case
 *
 * Automatically expires suspended members whose next_due_date has passed.
 *
 * @example
 * const expireSuspended = new ExpireSuspendedMembers(memberRepository);
 * const summary = await expireSuspended.execute();
 * console.log(`Expired ${summary.totalExpired} suspended members`);
 */
export class ExpireSuspendedMembers {
  constructor(private readonly memberRepo: IMemberRepository) {}

  /**
   * Execute suspended member expiration
   *
   * @returns Summary of expirations
   */
  async execute(): Promise<ExpireSuspendedMembersSummary> {
    const summary: ExpireSuspendedMembersSummary = {
      totalExpired: 0,
      expiredMembers: [],
      errors: [],
    };

    try {
      console.log('🔄 Checking for overdue suspended members...');

      // Get today's date (00:00:00) to compare against due dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find all suspended members
      // We'll filter in memory until we add a dedicated repository method
      const suspendedMembers = await this.getAllSuspendedMembersAcrossGyms();

      // Filter members whose next_due_date < today
      const overdueSuspendedMembers = suspendedMembers.filter((member) => {
        const dueDate = new Date(member.nextDueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate < today;
      });

      console.log(`  Found ${overdueSuspendedMembers.length} overdue suspended members`);

      // Expire each overdue suspended member
      for (const member of overdueSuspendedMembers) {
        try {
          // Use state machine to transition Suspended → Expired
          const expiredMember = member.expire();

          // Persist update
          await this.memberRepo.update(expiredMember);

          // Add to summary
          summary.totalExpired++;
          summary.expiredMembers.push({
            id: member.id,
            name: member.name,
            nextDueDate: member.nextDueDate,
          });

          console.log(`  - Expired: ${member.name} (was due: ${this.formatDate(member.nextDueDate)})`);
        } catch (error) {
          const errorMsg = `Failed to expire suspended member ${member.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          summary.errors.push(errorMsg);
          console.error(`  ✗ ${errorMsg}`);
        }
      }

      if (summary.totalExpired > 0) {
        console.log(`✅ Expired ${summary.totalExpired} suspended member(s)`);
      } else {
        console.log('✓ No suspended members need expiration');
      }
    } catch (error) {
      const errorMsg = `Fatal error in ExpireSuspendedMembers: ${error instanceof Error ? error.message : 'Unknown error'}`;
      summary.errors.push(errorMsg);
      console.error(errorMsg);
    }

    return summary;
  }

  /**
   * Get all suspended members across all gyms
   *
   * This queries the repository for all members with status='suspended'.
   *
   * @returns Array of suspended members
   */
  private async getAllSuspendedMembersAcrossGyms(): Promise<Member[]> {
    // Use findAllSuspendedMembers() method from repository
    return await this.memberRepo.findAllSuspendedMembers();
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
