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
 * 5. Sending reminder SMS, naming the member's gym (names read once per run)
 * 6. Logging to database
 * 7. Aggregating results
 */

import { Member } from '@/features/members/domain/Member'
import { IMemberRepository } from '@/features/members/services/IMemberRepository'
import { ISMSRepository } from './ISMSRepository'
import type { IGymSubscriptionRepository } from '@/features/subscriptions/services/IGymSubscriptionRepository'
import { ISMSProvider } from './ISMSProvider'
import type { IGymDirectory } from './IGymDirectory'
import { SaasStatus } from '@/features/subscriptions/config/SubscriptionConfig'
import { getDaysUntilDue } from '@/features/members/utils/getDaysUntilDue'
import {
  shouldSendReminder,
  ReminderType,
} from '@/features/sms/config/ReminderConfig'
import { reminderSms } from '@/features/sms/config/SmsTemplates'
import { SMSDeliveryStatus } from '@/features/sms/services/ISMSRepository'

/**
 * Input for sending automated reminders
 */
export interface SendAutomatedRemindersInput {
  /**
   * Gym ID to process reminders for
   * If not provided, processes all gyms
   */
  gymId?: string
}

/**
 * Summary of reminders sent
 */
export interface ReminderSummary {
  /**
   * Total reminders sent
   */
  totalSent: number

  /**
   * Reminders sent by type
   */
  byType: Record<ReminderType, number>

  /**
   * Errors encountered
   */
  errors: string[]

  /**
   * Members processed
   */
  membersProcessed: number

  /**
   * Members skipped (with reasons)
   */
  membersSkipped: number

  /**
   * Members skipped because their gym's billing status halts reminders
   * (suspended / canceled / past_due beyond grace). Reminders are available
   * on EVERY tier — only the account status gates them.
   */
  membersSkippedBillingRestricted: number
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
 *   smsProvider,
 *   gymSubscriptionRepository,
 *   gymDirectory
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
    private readonly gymSubscriptionRepo: IGymSubscriptionRepository,
    private readonly gymDirectory: IGymDirectory
  ) {}

  /**
   * Resolve which of the given gyms may receive automated reminders.
   * Reminders exist on every tier — the gate is BILLING STATUS only:
   * send while trialing, active, past_due within grace, or canceled while
   * still paid-through (the customer keeps what they paid for until period
   * end); halt for suspended accounts and lapsed windows. One subscription
   * lookup per DISTINCT gym; a gym whose subscription cannot be resolved is
   * treated as restricted (fail closed).
   */
  private async resolveAllowedGyms(gymIds: string[]): Promise<Set<string>> {
    const allowed = new Set<string>()
    const now = new Date()
    for (const gymId of new Set(gymIds)) {
      const sub = await this.gymSubscriptionRepo.findByGymId(gymId)
      if (!sub) continue
      const sendable =
        sub.status === SaasStatus.Trialing ||
        sub.status === SaasStatus.Active ||
        (sub.status === SaasStatus.PastDue && !sub.isGraceExpired(now)) ||
        (sub.status === SaasStatus.Canceled && sub.isPaidThrough(now))
      if (sendable) {
        allowed.add(gymId)
      }
    }
    return allowed
  }

  /**
   * Execute automated reminder sending
   *
   * @param input - Input parameters (optional gymId)
   * @returns Summary of reminders sent
   */
  async execute(
    input: SendAutomatedRemindersInput = {}
  ): Promise<ReminderSummary> {
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
    }

    try {
      // Get active members
      const allMembers = input.gymId
        ? await this.memberRepo.findActiveMembers(input.gymId)
        : await this.memberRepo.findAllActiveMembers()

      // Billing-status gate: reminders exist on every tier, but suspended
      // accounts and lapsed windows (grace-expired past_due, canceled past
      // period end) are halted before any reminder logic runs. One
      // subscription lookup per distinct gym.
      const allowedGyms = await this.resolveAllowedGyms(
        allMembers.map((m) => m.gymId)
      )
      const members = allMembers.filter((m) => allowedGyms.has(m.gymId))
      summary.membersSkippedBillingRestricted =
        allMembers.length - members.length
      if (summary.membersSkippedBillingRestricted > 0) {
        console.log(
          `⏭  Skipping ${summary.membersSkippedBillingRestricted} member(s) of billing-restricted (suspended/lapsed) gyms`
        )
      }

      console.log(
        `📊 Processing ${members.length} active members for reminders`
      )

      // Every reminder names the member's gym (the sender ID is
      // platform-wide). One read for every gym this run can send for —
      // never one per member.
      const gymNames =
        allowedGyms.size > 0
          ? await this.gymDirectory.findNamesByIds([...allowedGyms])
          : new Map<string, string>()

      // Process each member
      for (const member of members) {
        summary.membersProcessed++

        try {
          const gymName = gymNames.get(member.gymId)
          if (!gymName) {
            // gyms.gym_name is NOT NULL, so this means the read missed the
            // row. Fail closed: a reminder must name the gym.
            throw new Error('gym name not found')
          }
          const sent = await this.processMemberReminder(
            member,
            gymName,
            summary
          )
          if (!sent) {
            summary.membersSkipped++
          }
        } catch (error) {
          const errorMsg = `Failed to process member ${member.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          summary.errors.push(errorMsg)
          console.error(`  ✗ ${errorMsg}`)
        }
      }

      console.log(`✅ Automated reminders complete:`)
      console.log(`   - Total sent: ${summary.totalSent}`)
      console.log(`   - 7-Day: ${summary.byType[ReminderType.SevenDay]}`)
      console.log(`   - 3-Day: ${summary.byType[ReminderType.ThreeDay]}`)
      console.log(`   - Due Today: ${summary.byType[ReminderType.DueToday]}`)
      console.log(`   - Overdue: ${summary.byType[ReminderType.Overdue]}`)
      console.log(`   - Members processed: ${summary.membersProcessed}`)
      console.log(`   - Members skipped: ${summary.membersSkipped}`)

      if (summary.errors.length > 0) {
        console.log(`   ⚠️  Errors: ${summary.errors.length}`)
      }
    } catch (error) {
      const errorMsg = `Fatal error in SendAutomatedReminders: ${error instanceof Error ? error.message : 'Unknown error'}`
      summary.errors.push(errorMsg)
      console.error(errorMsg)
    }

    return summary
  }

  /**
   * Process reminder for a single member
   *
   * @param member - Member to process
   * @param gymName - The member's gym, printed in the text
   * @param summary - Summary object to update
   * @returns True if reminder was sent, false if skipped
   */
  private async processMemberReminder(
    member: Member,
    gymName: string,
    summary: ReminderSummary
  ): Promise<boolean> {
    // Calculate days until due
    const daysUntilDue = getDaysUntilDue(member.nextDueDate)

    console.log(
      `  Member: ${member.name}, Plan: ${member.planType}, Days until due: ${daysUntilDue}`
    )

    // Check if reminder should be sent for this plan type and days
    if (!shouldSendReminder(member.planType, daysUntilDue)) {
      console.log(
        `    → Skipped: No reminder configured for ${member.planType} at ${daysUntilDue} days`
      )
      return false
    }

    // Determine SMS type
    const smsType = this.determineSMSType(daysUntilDue)
    if (!smsType) {
      console.log(`    → Skipped: Invalid days until due (${daysUntilDue})`)
      return false
    }

    console.log(`    → Sending ${smsType} reminder`)

    // Check for duplicate (already sent today)
    const alreadySent = await this.smsRepo.existsForToday(member.id, smsType)

    if (alreadySent) {
      console.log(`    → Skipped: ${smsType} already sent today`)
      return false
    }

    // Send reminder
    await this.sendReminder(member, gymName, smsType)

    // Update summary
    summary.totalSent++
    summary.byType[smsType]++

    console.log(`  ✓ Sent ${smsType} to ${member.name}`)

    return true
  }

  /**
   * Determine SMS type based on days until due
   *
   * `getDaysUntilDue` returns whole days, so `>= 0 && < 1` is exactly
   * `daysUntilDue === 0` — the DueToday branch already owns the due date, and
   * it is evaluated BEFORE the overdue branch. Narrowing the overdue branch to
   * `=== 0` would therefore make it unreachable rather than move the message.
   *
   * The `< 0` branch is kept deliberately as a SAFETY NET, not as a routine
   * path: with instant expiry, update-expired-status (00:00) flips overdue
   * members to Expired before send-reminders runs (03:30), and this job only
   * reads ACTIVE members — so an overdue active should not exist. If the expiry
   * cron fails or is skipped, this keeps chasing the payment instead of going
   * silent.
   *
   * @param daysUntilDue - Days until payment is due
   * @returns SMS type, or null if no reminder needed
   */
  private determineSMSType(daysUntilDue: number): ReminderType | null {
    if (daysUntilDue >= 7 && daysUntilDue < 8) {
      return ReminderType.SevenDay
    } else if (daysUntilDue >= 3 && daysUntilDue < 4) {
      return ReminderType.ThreeDay
    } else if (daysUntilDue >= 0 && daysUntilDue < 1) {
      return ReminderType.DueToday
    } else if (daysUntilDue < 0) {
      return ReminderType.Overdue
    }
    return null
  }

  /**
   * Send reminder SMS to member
   *
   * @param member - Member to send reminder to
   * @param gymName - The member's gym, printed in the text
   * @param smsType - Type of reminder
   */
  private async sendReminder(
    member: Member,
    gymName: string,
    smsType: ReminderType
  ): Promise<void> {
    try {
      const message = reminderSms(smsType, {
        gymName,
        memberName: member.name,
        planType: member.planType,
        amount: member.planAmount,
        dueDate: member.nextDueDate,
      })

      // Send SMS
      const result = await this.smsProvider.send({
        to: member.phoneNumber,
        message,
      })

      if (!result.success) {
        throw new Error(result.error || 'SMS sending failed')
      }

      // Log to database
      await this.smsRepo.create({
        memberId: member.id,
        gymId: member.gymId,
        smsType,
        phoneNumber: member.phoneNumber,
        messageBody: message,
        sentAt: new Date(),
        deliveryStatus: result.success
          ? SMSDeliveryStatus.Sent
          : SMSDeliveryStatus.Failed,
        textLkMessageId: result.messageId || null,
        errorMessage: result.success ? null : result.error || 'Unknown error',
      })
    } catch (error) {
      console.error(`Failed to send ${smsType} to ${member.name}:`, error)
      throw error
    }
  }
}
