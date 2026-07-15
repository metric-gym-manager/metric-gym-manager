/**
 * Issue Day Pass Use Case
 *
 * Records a single-day access fee for an existing member whose membership
 * period has ended (e.g. a monthly member whose plan expired but who comes
 * in for one day and pays the daily fee at the desk).
 *
 * Business rules:
 * - Allowed when the member's next_due_date is today or in the past AND the
 *   member is 'active' (due/overdue but the nightly expiry cron has not
 *   flipped them yet — members now expire as soon as the membership lapses)
 *   or 'expired'.
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

import { Member } from '@/core/domain/member/Member';
import { Payment, PaymentType } from '@/core/domain/payment/Payment';
import { IMemberRepository, IPaymentRepository, ISMSRepository } from '@/core/ports/repositories';
import { ISMSProvider } from '@/core/ports/services';
import { SMSDeliveryStatus } from '@/core/ports/repositories/ISMSRepository';
import { calculateNextDueDate, formatDateForDisplay } from '@/core/utils/date';
import { getDaysUntilDue } from '@/core/utils/date/getDaysUntilDue';
import { PlanType } from '@/core/utils/constants/PlanConfig';
import { MemberStatus } from '@/core/utils/constants/StatusConfig';
import {
  BusinessRuleViolationError,
  NotFoundError,
  ValidationError,
} from '@/core/utils/errors';

/**
 * Input for issuing a day pass
 */
export interface IssueDayPassInput {
  /**
   * Gym ID (for multi-tenancy)
   */
  gymId: string;

  /**
   * Member ID
   */
  memberId: string;

  /**
   * Day pass fee in LKR (typically the gym's daily plan default amount)
   */
  amount: number;

  /**
   * Payment date (defaults to today)
   */
  paymentDate?: Date;
}

/**
 * Output of issuing a day pass
 */
export interface IssueDayPassOutput {
  /**
   * Updated member (active until tomorrow)
   */
  member: Member;

  /**
   * Day pass payment record
   */
  payment: Payment;
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
      throw new ValidationError('Day pass amount must be greater than zero');
    }

    const member = await this.memberRepo.findById(input.memberId, input.gymId);

    if (!member) {
      throw new NotFoundError(`Member ${input.memberId}`);
    }

    // Suspended/cancelled members must go through their dedicated flows
    if (
      member.status === MemberStatus.Suspended ||
      member.status === MemberStatus.Cancelled
    ) {
      throw new BusinessRuleViolationError(
        `Cannot issue a day pass for a ${member.status} member`,
        'day_pass_member_status'
      );
    }

    // Members still within their membership period don't need a day pass.
    // getDaysUntilDue > 0 means next_due_date is in the future; 0 (due today)
    // and negative (overdue/expired) are eligible.
    const daysUntilDue = getDaysUntilDue(member.nextDueDate);
    if (daysUntilDue > 0) {
      throw new BusinessRuleViolationError(
        `Member is active until ${formatDateForDisplay(member.nextDueDate)} — no day pass needed`,
        'day_pass_membership_active'
      );
    }

    const paymentDate = input.paymentDate ?? new Date();

    // Day pass expires the next day (same duration as the daily plan)
    const nextDueDate = calculateNextDueDate(paymentDate, PlanType.Daily, {
      deductOverduePeriod: true,
    });

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
    });

    const savedPayment = await this.paymentRepo.create(payment);

    // Move the member's access window to tomorrow WITHOUT touching plan_type.
    // Expired members transition back to active (state machine enforced);
    // overdue-but-still-active members just get the new due date.
    const processedMember =
      member.status === MemberStatus.Active
        ? member.updateNextDueDate(nextDueDate)
        : member.activate(nextDueDate);

    const updatedMember = await this.memberRepo.update(processedMember);

    // Send receipt SMS before returning (serverless freeze would drop a
    // fire-and-forget sms_logs write). A failed SMS never fails the day pass.
    try {
      await this.sendDayPassReceiptSMS(updatedMember, input.amount, nextDueDate);
    } catch (error) {
      console.error('Failed to send day pass receipt SMS:', error);
    }

    return {
      member: updatedMember,
      payment: savedPayment,
    };
  }

  /**
   * Send day pass receipt SMS to member and log it
   *
   * @param member - Member who bought the day pass
   * @param amountPaid - Day pass fee
   * @param validUntil - Day pass expiry date
   */
  private async sendDayPassReceiptSMS(
    member: Member,
    amountPaid: number,
    validUntil: Date
  ): Promise<void> {
    const message =
      `Dear ${member.name}, day pass payment of Rs.${amountPaid.toFixed(2)} received. ` +
      `Valid until ${formatDateForDisplay(validUntil)}. Thank you!`;

    try {
      const result = await this.smsProvider.send({
        to: member.phoneNumber,
        message,
      });

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
      });

      if (!result.success) {
        console.error('Day pass receipt SMS failed:', result.error);
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
        });
      } catch (logError) {
        console.error('Failed to log SMS failure:', logError);
      }
      console.error('Exception sending day pass receipt SMS:', error);
    }
  }
}
