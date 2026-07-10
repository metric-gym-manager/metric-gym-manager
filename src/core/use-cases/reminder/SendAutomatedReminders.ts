/**
 * Send Automated Reminders Use Case
 *
 * Handles automated payment reminder SMS sending for members.
 *
 * Extracted from: src/features/sms/services/reminder.service.ts (lines 106-309)
 *
 * This use case orchestrates:
 * 1. Fetching active members
 * 2. Calculating days until due for each member
 * 3. Determining if reminder should be sent (using centralized rules)
 * 4. Checking for duplicate reminders (already sent today)
 * 5. Sending reminder SMS
 * 6. Logging to database
 * 7. Aggregating results
 */

import { Member } from '@/core/domain/member/Member';
import { IMemberRepository, ISMSRepository } from '@/core/ports/repositories';
import type { IGymSubscriptionRepository } from '@/core/ports/repositories/IGymSubscriptionRepository';
import { ISMSProvider } from '@/core/ports/services';
import { SaasStatus } from '@/core/utils/constants/SubscriptionConfig';
import { getDaysUntilDue } from '@/core/utils/date';
import { formatDateForDisplay } from '@/core/utils/date';
import { shouldSendReminder, ReminderType } from '@/core/utils/constants/ReminderConfig';
import { SMSDeliveryStatus } from '@/core/ports/repositories/ISMSRepository';
import { PlanType } from '@/core/utils/constants/PlanConfig';

/**
 * Input for sending automated reminders
 */
export interface SendAutomatedRemindersInput {
  /**
   * Gym ID to process reminders for
   * If not provided, processes all gyms
   */
  gymId?: string;
}

/**
 * Summary of reminders sent
 */
export interface ReminderSummary {
  /**
   * Total reminders sent
   */
  totalSent: number;

  /**
   * Reminders sent by type
   */
  byType: Record<ReminderType, number>;

  /**
   * Errors encountered
   */
  errors: string[];

  /**
   * Members processed
   */
  membersProcessed: number;

  /**
   * Members skipped (with reasons)
   */
  membersSkipped: number;

  /**
   * Members skipped because their gym's billing status halts reminders
   * (suspended / canceled / past_due beyond grace). Reminders are available
   * on EVERY tier — only the account status gates them.
   */
  membersSkippedBillingRestricted: number;
}

/**
 * Send Automated Reminders Use Case
 *
 * Processes active members and sends payment reminder SMS based on:
 * - Days until due date
 * - Plan type (daily members excluded, monthly skips 7-day)
 * - Duplicate prevention (one reminder per type per day)
 *
 * @example
 * const sendReminders = new SendAutomatedReminders(
 *   memberRepository,
 *   smsRepository,
 *   smsProvider
 * );
 *
 * const summary = await sendReminders.execute({ gymId: 'gym-123' });
 * console.log(`Sent ${summary.totalSent} reminders`);
 */
export class SendAutomatedReminders {
  constructor(
    private readonly memberRepo: IMemberRepository,
    private readonly smsRepo: ISMSRepository,
    private readonly smsProvider: ISMSProvider,
    private readonly gymSubscriptionRepo: IGymSubscriptionRepository
  ) {}

  /**
   * Resolve which of the given gyms may receive automated reminders.
   * Reminders exist on every tier — the gate is BILLING STATUS only:
   * send while trialing, active or past_due within grace; halt for
   * suspended and canceled accounts. One subscription lookup per DISTINCT
   * gym; a gym whose subscription cannot be resolved is treated as
   * restricted (fail closed).
   */
  private async resolveAllowedGyms(gymIds: string[]): Promise<Set<string>> {
    const allowed = new Set<string>();
    const now = new Date();
    for (const gymId of new Set(gymIds)) {
      const sub = await this.gymSubscriptionRepo.findByGymId(gymId);
      if (!sub) continue;
      const sendable =
        sub.status === SaasStatus.Trialing ||
        sub.status === SaasStatus.Active ||
        (sub.status === SaasStatus.PastDue && !sub.isGraceExpired(now));
      if (sendable) {
        allowed.add(gymId);
      }
    }
    return allowed;
  }

  /**
   * Execute automated reminder sending
   *
   * @param input - Input parameters (optional gymId)
   * @returns Summary of reminders sent
   */
  async execute(input: SendAutomatedRemindersInput = {}): Promise<ReminderSummary> {
    const summary: ReminderSummary = {
      totalSent: 0,
      byType: {
        [ReminderType.SevenDay]: 0,
        [ReminderType.ThreeDay]: 0,
        [ReminderType.DueToday]: 0,
        [ReminderType.Overdue]: 0,
      },
      errors: [],
      membersProcessed: 0,
      membersSkipped: 0,
      membersSkippedBillingRestricted: 0,
    };

    try {
      // Get active members
      const allMembers = input.gymId
        ? await this.memberRepo.findActiveMembers(input.gymId)
        : await this.memberRepo.findAllActiveMembers();

      // Billing-status gate: reminders exist on every tier, but suspended /
      // canceled / grace-expired accounts are halted before any reminder
      // logic runs. One subscription lookup per distinct gym.
      const allowedGyms = await this.resolveAllowedGyms(allMembers.map((m) => m.gymId));
      const members = allMembers.filter((m) => allowedGyms.has(m.gymId));
      summary.membersSkippedBillingRestricted = allMembers.length - members.length;
      if (summary.membersSkippedBillingRestricted > 0) {
        console.log(
          `⏭  Skipping ${summary.membersSkippedBillingRestricted} member(s) of billing-restricted (suspended/canceled) gyms`
        );
      }

      console.log(`📊 Processing ${members.length} active members for reminders`);

      // Process each member
      for (const member of members) {
        summary.membersProcessed++;

        try {
          const sent = await this.processMemberReminder(member, summary);
          if (!sent) {
            summary.membersSkipped++;
          }
        } catch (error) {
          const errorMsg = `Failed to process member ${member.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          summary.errors.push(errorMsg);
          console.error(`  ✗ ${errorMsg}`);
        }
      }

      console.log(`✅ Automated reminders complete:`);
      console.log(`   - Total sent: ${summary.totalSent}`);
      console.log(`   - 7-Day: ${summary.byType[ReminderType.SevenDay]}`);
      console.log(`   - 3-Day: ${summary.byType[ReminderType.ThreeDay]}`);
      console.log(`   - Due Today: ${summary.byType[ReminderType.DueToday]}`);
      console.log(`   - Overdue: ${summary.byType[ReminderType.Overdue]}`);
      console.log(`   - Members processed: ${summary.membersProcessed}`);
      console.log(`   - Members skipped: ${summary.membersSkipped}`);

      if (summary.errors.length > 0) {
        console.log(`   ⚠️  Errors: ${summary.errors.length}`);
      }
    } catch (error) {
      const errorMsg = `Fatal error in SendAutomatedReminders: ${error instanceof Error ? error.message : 'Unknown error'}`;
      summary.errors.push(errorMsg);
      console.error(errorMsg);
    }

    return summary;
  }

  /**
   * Process reminder for a single member
   *
   * @param member - Member to process
   * @param summary - Summary object to update
   * @returns True if reminder was sent, false if skipped
   */
  private async processMemberReminder(
    member: Member,
    summary: ReminderSummary
  ): Promise<boolean> {
    // Calculate days until due
    const daysUntilDue = getDaysUntilDue(member.nextDueDate);

    console.log(`  Member: ${member.name}, Plan: ${member.planType}, Days until due: ${daysUntilDue}`);

    // Check if reminder should be sent for this plan type and days
    if (!shouldSendReminder(member.planType, daysUntilDue)) {
      console.log(`    → Skipped: No reminder configured for ${member.planType} at ${daysUntilDue} days`);
      return false;
    }

    // Determine SMS type
    const smsType = this.determineSMSType(daysUntilDue);
    if (!smsType) {
      console.log(`    → Skipped: Invalid days until due (${daysUntilDue})`);
      return false;
    }

    console.log(`    → Sending ${smsType} reminder`);

    // Check for duplicate (already sent today)
    const alreadySent = await this.smsRepo.existsForToday(member.id, smsType);

    if (alreadySent) {
      console.log(`    → Skipped: ${smsType} already sent today`);
      return false;
    }

    // Send reminder
    await this.sendReminder(member, smsType);

    // Update summary
    summary.totalSent++;
    summary.byType[smsType]++;

    console.log(`  ✓ Sent ${smsType} to ${member.name}`);

    return true;
  }

  /**
   * Determine SMS type based on days until due
   *
   * @param daysUntilDue - Days until payment is due
   * @returns SMS type, or null if no reminder needed
   */
  private determineSMSType(daysUntilDue: number): ReminderType | null {
    if (daysUntilDue >= 7 && daysUntilDue < 8) {
      return ReminderType.SevenDay;
    } else if (daysUntilDue >= 3 && daysUntilDue < 4) {
      return ReminderType.ThreeDay;
    } else if (daysUntilDue >= 0 && daysUntilDue < 1) {
      return ReminderType.DueToday;
    } else if (daysUntilDue < 0) {
      return ReminderType.Overdue;
    }
    return null;
  }

  /**
   * Send reminder SMS to member
   *
   * @param member - Member to send reminder to
   * @param smsType - Type of reminder
   */
  private async sendReminder(
    member: Member,
    smsType: ReminderType
  ): Promise<void> {
    try {
      // Generate reminder message
      const message = this.generateReminderMessage(member, smsType);

      // Send SMS
      const result = await this.smsProvider.send({
        to: member.phoneNumber,
        message,
      });

      if (!result.success) {
        throw new Error(result.error || 'SMS sending failed');
      }

      // Log to database
      await this.smsRepo.create({
        memberId: member.id,
        gymId: member.gymId,
        smsType,
        phoneNumber: member.phoneNumber,
        messageBody: message,
        sentAt: new Date(),
        deliveryStatus: result.success ? SMSDeliveryStatus.Sent : SMSDeliveryStatus.Failed,
        textLkMessageId: result.messageId || null,
        errorMessage: result.success ? null : (result.error || 'Unknown error'),
      });
    } catch (error) {
      console.error(`Failed to send ${smsType} to ${member.name}:`, error);
      throw error;
    }
  }

  /**
   * Generate reminder message based on SMS type
   *
   * @param member - Member receiving reminder
   * @param smsType - Type of reminder
   * @returns SMS message body
   */
  private generateReminderMessage(
    member: Member,
    smsType: ReminderType
  ): string {
    const planType = this.formatPlanType(member.planType);
    const dueDate = formatDateForDisplay(member.nextDueDate);
    const amount = `Rs.${member.planAmount.toFixed(2)}`;

    // Different messages based on reminder type
    switch (smsType) {
      case ReminderType.Overdue:
        return (
          `Dear ${member.name}, your ${planType} membership payment was due on ${dueDate}. ` +
          `Amount: ${amount}. Please make payment. Thank you.`
        );

      case ReminderType.DueToday:
        return (
          `Dear ${member.name}, your ${planType} membership payment is due today. ` +
          `Amount: ${amount}. Please make payment. Thank you.`
        );

      case ReminderType.ThreeDay:
      case ReminderType.SevenDay:
      default:
        return (
          `Dear ${member.name}, your ${planType} membership payment is due on ${dueDate}. ` +
          `Amount: ${amount}. Thank you.`
        );
    }
  }

  /**
   * Format plan type for display
   *
   * @param planType - Plan type enum
   * @returns Formatted plan type (e.g., "Monthly", "3-Months")
   */
  private formatPlanType(planType: PlanType): string {
    return planType.charAt(0).toUpperCase() + planType.slice(1).replace('-', '-');
  }
}
