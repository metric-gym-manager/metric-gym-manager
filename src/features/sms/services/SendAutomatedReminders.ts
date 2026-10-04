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
import type { ISMSProvider, SMSSendResult } from './ISMSProvider'
import type { IGymDirectory } from './IGymDirectory'
import type { IDiscountDirectory } from './IDiscountDirectory'
import { effectivePlanAmount } from '@/features/members/utils/effectivePlanAmount'
import { isSmsDisabledForGym } from '@/features/sms/config/SmsSuppression'
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

  /**
   * Members skipped because their gym is on the operator's never-text list
   * (`SMS_DISABLED_GYM_IDS`, e.g. the E2E test gyms). Not attempted, so they
   * leave no failed row and no run error.
   */
  membersSkippedSmsDisabled: number
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
    private readonly gymDirectory: IGymDirectory,
    private readonly discountDirectory: IDiscountDirectory
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
      membersSkippedSmsDisabled: 0,
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
      const billable = allMembers.filter((m) => allowedGyms.has(m.gymId))
      summary.membersSkippedBillingRestricted =
        allMembers.length - billable.length
      if (summary.membersSkippedBillingRestricted > 0) {
        console.log(
          `⏭  Skipping ${summary.membersSkippedBillingRestricted} member(s) of billing-restricted (suspended/lapsed) gyms`
        )
      }

      // The operator's never-text list (SMS_DISABLED_GYM_IDS): the E2E test
      // gyms run in production with valid-format seeded numbers. Skipped up
      // front rather than refused at the send layer, so a test gym leaves no
      // daily batch of failed rows and run errors. sendSmsViaTextLk refuses
      // them too, for every other path.
      const members = billable.filter((m) => !isSmsDisabledForGym(m.gymId))
      summary.membersSkippedSmsDisabled = billable.length - members.length
      if (summary.membersSkippedSmsDisabled > 0) {
        console.log(
          `⏭  Skipping ${summary.membersSkippedSmsDisabled} member(s) of gyms with texts disabled`
        )
      }

      console.log(
        `📊 Processing ${members.length} active members for reminders`
      )

      // Every reminder names the member's gym (the sender ID is
      // platform-wide). One read for every gym this run can send for —
      // never one per member.
      const textableGyms = new Set(members.map((m) => m.gymId))
      const gymNames =
        textableGyms.size > 0
          ? await this.gymDirectory.findNamesByIds([...textableGyms])
          : new Map<string, string>()

      // A reminder quotes what the desk will charge: the plan amount less a
      // recurring discount. One read for every discount this run needs.
      const recurringDiscountIds = [
        ...new Set(
          members
            .filter((m) => m.recurringDiscount && m.discountId)
            .map((m) => m.discountId as string)
        ),
      ]
      const discountPercentages =
        recurringDiscountIds.length > 0
          ? await this.discountDirectory.findPercentagesByIds(
              recurringDiscountIds
            )
          : new Map<string, number>()

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
          const amount = effectivePlanAmount({
            planAmount: member.planAmount,
            recurringDiscount: member.recurringDiscount,
            discountPercentage: member.discountId
              ? (discountPercentages.get(member.discountId) ?? null)
              : null,
          })
          const sent = await this.processMemberReminder(
            member,
            gymName,
            amount,
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
   * @param amount - The amount the reminder quotes (after a recurring discount)
   * @param summary - Summary object to update
   * @returns True if reminder was sent, false if skipped
   */
  private async processMemberReminder(
    member: Member,
    gymName: string,
    amount: number,
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
    await this.sendReminder(member, gymName, amount, smsType)

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
   * Send a reminder SMS and log the outcome — success AND failure (rule 2.7).
   *
   * A failed send is written to sms_logs as `failed` with its reason, then
   * re-thrown so the run counts it in `summary.errors` and not as sent. The
   * failure used to throw before any insert, so no failed reminder ever reached
   * the member's history or the system-health failures table.
   *
   * @param member - Member to send reminder to
   * @param gymName - The member's gym, printed in the text
   * @param amount - The amount the reminder quotes (after a recurring discount)
   * @param smsType - Type of reminder
   * @throws Error when the text cannot be built or the provider fails
   */
  private async sendReminder(
    member: Member,
    gymName: string,
    amount: number,
    smsType: ReminderType
  ): Promise<void> {
    let message = ''
    let result: SMSSendResult
    try {
      message = reminderSms(smsType, {
        gymName,
        memberName: member.name,
        planType: member.planType,
        amount,
        dueDate: member.nextDueDate,
      })
      result = await this.smsProvider.send({
        gymId: member.gymId,
        to: member.phoneNumber,
        message,
      })
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Exception sending SMS'
      await this.logFailedReminder(member, smsType, message, reason)
      console.error(`Failed to send ${smsType} to ${member.name}:`, error)
      throw error
    }

    if (!result.success) {
      const reason = result.error || 'SMS sending failed'
      await this.logFailedReminder(member, smsType, message, reason)
      console.error(`Failed to send ${smsType} to ${member.name}:`, reason)
      throw new Error(reason)
    }

    await this.smsRepo.create({
      memberId: member.id,
      gymId: member.gymId,
      smsType,
      phoneNumber: member.phoneNumber,
      messageBody: message,
      sentAt: new Date(),
      deliveryStatus: SMSDeliveryStatus.Sent,
      textLkMessageId: result.messageId || null,
      errorMessage: null,
    })
  }

  /**
   * Record a failed reminder. Never throws: if the log write itself fails,
   * the original send failure must still reach the run's summary.
   *
   * @param messageBody - The text, or '' when it could not be built
   * @param reason - Why the send failed
   */
  private async logFailedReminder(
    member: Member,
    smsType: ReminderType,
    messageBody: string,
    reason: string
  ): Promise<void> {
    try {
      await this.smsRepo.create({
        memberId: member.id,
        gymId: member.gymId,
        smsType,
        phoneNumber: member.phoneNumber,
        messageBody,
        sentAt: new Date(),
        deliveryStatus: SMSDeliveryStatus.Failed,
        textLkMessageId: null,
        errorMessage: reason,
      })
    } catch (logError) {
      console.error('Failed to log reminder failure:', logError)
    }
  }
}
