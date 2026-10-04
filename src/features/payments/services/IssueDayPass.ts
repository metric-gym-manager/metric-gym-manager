/**
 * Issue Day Pass Use Case
 *
 * Records a single-day access fee for an existing member whose membership
 * period has ended (e.g. a monthly member whose plan expired but who comes
 * in for one day and pays the daily fee at the desk).
 *
 * Business rules:
 * - Allowed when the member's next_due_date is today or in the past AND the
 *   member is 'active' (overdue grace window before the nightly cron flips
 *   them) or 'expired'.
 * - Rejected when the member is still within their membership period
 *   (next_due_date in the future) — they don't need a day pass.
 * - Rejected for suspended/cancelled members — those have dedicated
 *   reactivation flows.
 * - The member's plan_type is NOT changed: a later monthly/annual renewal
 *   behaves exactly as before. Only next_due_date moves to tomorrow, so the
 *   nightly expiry cron returns the member to 'expired' after the day pass
 *   lapses — identical to how daily-plan members already cycle.
 * - Revenue is recorded as a payments row tagged payment_type='day_pass'
 *   (single source of truth for revenue reports).
 */

import { Member } from '@/features/members/domain/Member'
import { Payment, PaymentType } from '@/features/payments/domain/Payment'
import { IMemberRepository } from '@/features/members/services/IMemberRepository'
import { IPaymentRepository } from './IPaymentRepository'
import { ISMSRepository } from '@/features/sms/services/ISMSRepository'
import { ISMSProvider } from '@/features/sms/services/ISMSProvider'
import { SMSDeliveryStatus } from '@/features/sms/services/ISMSRepository'
import { calculateNextDueDate } from '@/features/members/utils/calculateNextDueDate'
import { dayPassSms } from '@/features/sms/config/SmsTemplates'
import { formatDateForDisplay } from '@/utils/date/date'
import { getDaysUntilDue } from '@/features/members/utils/getDaysUntilDue'
import { PlanType } from '@/features/members/config/PlanConfig'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import {
  BusinessRuleViolationError,
  NotFoundError,
  ValidationError,
} from '@/utils/errors'

/**
 * Input for issuing a day pass
 */
export interface IssueDayPassInput {
  /**
   * Gym ID (for multi-tenancy)
   */
  gymId: string

  /**
   * The gym's name (`gyms.gym_name`), printed in the receipt SMS. Every
   * automated text names the gym; the sender ID is platform-wide.
   */
  gymName: string

  /**
   * Member ID
   */
  memberId: string

  /**
   * Day pass fee in LKR (typically the gym's daily plan default amount)
   */
  amount: number

  /**
   * Payment date (defaults to today)
   */
  paymentDate?: Date
}

/**
 * Output of issuing a day pass
 */
export interface IssueDayPassOutput {
  /**
   * Updated member (active until tomorrow)
   */
  member: Member

  /**
   * Day pass payment record
   */
  payment: Payment
}

/**
 * Issue Day Pass Use Case
 *
 * @example
 * const issueDayPass = new IssueDayPass(
 *   memberRepository,
 *   paymentRepository,
 *   smsProvider,
 *   smsRepository
 * );
 *
 * const result = await issueDayPass.execute({
 *   gymId: 'gym-123',
 *   gymName: 'Titan Fitness',
 *   memberId: 'member-456',
 *   amount: 500,
 * });
 */
export class IssueDayPass {
  constructor(
    private readonly memberRepo: IMemberRepository,
    private readonly paymentRepo: IPaymentRepository,
    private readonly smsProvider: ISMSProvider,
    private readonly smsRepo: ISMSRepository
  ) {}

  /**
   * Execute day pass issuance
   *
   * @param input - Day pass input
   * @returns Updated member and day pass payment
   * @throws NotFoundError if member doesn't exist in this gym
   * @throws ValidationError if amount is invalid
   * @throws BusinessRuleViolationError if the member is not eligible
   */
  async execute(input: IssueDayPassInput): Promise<IssueDayPassOutput> {
    if (input.amount <= 0) {
      throw new ValidationError('Day pass amount must be greater than zero')
    }

    const member = await this.memberRepo.findById(input.memberId, input.gymId)

    if (!member) {
      throw new NotFoundError(`Member ${input.memberId}`)
    }

    // Suspended/cancelled members must go through their dedicated flows
    if (
      member.status === MemberStatus.Suspended ||
      member.status === MemberStatus.Cancelled
    ) {
      throw new BusinessRuleViolationError(
        `Cannot issue a day pass for a ${member.status} member`,
        'day_pass_member_status'
      )
    }

    // Members still within their membership period don't need a day pass.
    // getDaysUntilDue > 0 means next_due_date is in the future; 0 (due today)
    // and negative (overdue/expired) are eligible.
    const daysUntilDue = getDaysUntilDue(member.nextDueDate)
    if (daysUntilDue > 0) {
      throw new BusinessRuleViolationError(
        `Member is active until ${formatDateForDisplay(member.nextDueDate)} — no day pass needed`,
        'day_pass_membership_active'
      )
    }

    const paymentDate = input.paymentDate ?? new Date()

    // Day pass expires the next day (same duration as the daily plan)
    const nextDueDate = calculateNextDueDate(paymentDate, PlanType.Daily, {
      deductOverduePeriod: true,
    })

    // Record revenue as a day-pass payment
    const payment = Payment.create({
      memberId: member.id,
      gymId: input.gymId,
      paymentDate,
      amountPaid: input.amount,
      discountApplied: null,
      discountPercentage: null,
      nextDueDateCalculated: nextDueDate,
      paymentType: PaymentType.DayPass,
    })

    const savedPayment = await this.paymentRepo.create(payment)

    // Move the member's access window to tomorrow WITHOUT touching plan_type.
    // Expired members transition back to active (state machine enforced);
    // overdue-but-still-active members just get the new due date.
    const processedMember =
      member.status === MemberStatus.Active
        ? member.updateNextDueDate(nextDueDate)
        : member.activate(nextDueDate)

    const updatedMember = await this.memberRepo.update(processedMember)

    // Send receipt SMS before returning (serverless freeze would drop a
    // fire-and-forget sms_logs write). A failed SMS never fails the day pass.
    try {
      await this.sendDayPassReceiptSMS(
        updatedMember,
        input.gymName,
        input.amount,
        nextDueDate
      )
    } catch (error) {
      console.error('Failed to send day pass receipt SMS:', error)
    }

    return {
      member: updatedMember,
      payment: savedPayment,
    }
  }

  /**
   * Send day pass receipt SMS to member and log it
   *
   * @param member - Member who bought the day pass
   * @param gymName - The gym's name, printed in the text
   * @param amountPaid - Day pass fee
   * @param validUntil - Day pass expiry date
   */
  private async sendDayPassReceiptSMS(
    member: Member,
    gymName: string,
    amountPaid: number,
    validUntil: Date
  ): Promise<void> {
    let message = ''

    try {
      // Built inside the try: a template that throws is a logged failure,
      // never a silently skipped text (rule 2.7).
      message = dayPassSms({
        gymName,
        memberName: member.name,
        amountPaid,
        validUntil,
      })

      const result = await this.smsProvider.send({
        gymId: member.gymId,
        to: member.phoneNumber,
        message,
      })

      await this.smsRepo.create({
        memberId: member.id,
        gymId: member.gymId,
        smsType: 'receipt',
        phoneNumber: member.phoneNumber,
        messageBody: message,
        sentAt: new Date(),
        deliveryStatus: result.success
          ? SMSDeliveryStatus.Sent
          : SMSDeliveryStatus.Failed,
        textLkMessageId: result.success ? result.messageId || null : null,
        errorMessage: result.success ? null : result.error || 'Unknown error',
      })

      if (!result.success) {
        console.error('Day pass receipt SMS failed:', result.error)
      }
    } catch (error) {
      try {
        await this.smsRepo.create({
          memberId: member.id,
          gymId: member.gymId,
          smsType: 'receipt',
          phoneNumber: member.phoneNumber,
          messageBody: message,
          sentAt: new Date(),
          deliveryStatus: SMSDeliveryStatus.Failed,
          textLkMessageId: null,
          errorMessage:
            error instanceof Error ? error.message : 'Exception sending SMS',
        })
      } catch (logError) {
        console.error('Failed to log SMS failure:', logError)
      }
      console.error('Exception sending day pass receipt SMS:', error)
    }
  }
}
