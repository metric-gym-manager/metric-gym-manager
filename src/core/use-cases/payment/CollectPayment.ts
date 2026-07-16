/**
 * Collect Payment Use Case
 *
 * Handles payment collection and member renewal.
 *
 * Extracted from: src/features/members/services/payment.service.ts (lines 86-223)
 *
 * This use case orchestrates:
 * 1. Fetching member from repository
 * 2. Validating member exists
 * 3. Calculating next due date (with deductOverduePeriod option)
 * 4. Activating/renewing member (state machine + active-member quota enforced;
 *    a quota block fails BEFORE any write — see step-4 comment in execute())
 * 5. Creating payment record
 * 6. Resetting reminder flags for new billing period
 * 7. Sending receipt SMS and logging it (awaited so serverless
 *    freeze after the response cannot drop the sms_logs write)
 */

import { Member } from '@/core/domain/member/Member';
import { Payment } from '@/core/domain/payment/Payment';
import { IMemberRepository, IPaymentRepository, ISMSRepository } from '@/core/ports/repositories';
import { ISMSProvider } from '@/core/ports/services';
import { SMSDeliveryStatus } from '@/features/sms/services/ISMSRepository';
import { calculateNextDueDate } from '@/core/utils/date';
import { formatDateForDisplay } from '@/core/utils/date';
import { NotFoundError, ValidationError } from '@/utils/errors';

/**
 * Discount information for payment
 */
export interface DiscountInfo {
  /**
   * Discount ID
   */
  discountId: string;

  /**
   * Discount name (for display)
   */
  discountName: string;

  /**
   * Discount percentage (0-100)
   */
  discountPercentage: number;
}

/**
 * Input for payment collection
 */
export interface CollectPaymentInput {
  /**
   * Gym ID (for multi-tenancy)
   */
  gymId: string;

  /**
   * Member ID
   */
  memberId: string;

  /**
   * Payment date
   */
  paymentDate: Date;

  /**
   * Payment amount in LKR
   */
  paymentAmount: number;

  /**
   * Discount ID (optional)
   */
  discountId?: string | null;

  /**
   * Discount information (for receipt)
   */
  discount?: DiscountInfo | null;

  /**
   * Whether to deduct overdue period when calculating next due date
   *
   * - true (default): Calculate from payment date (recommended)
   * - false: Calculate from current next_due_date (legacy behavior)
   *
   * @default true
   */
  deductOverduePeriod?: boolean;
}

/**
 * Output of payment collection
 */
export interface CollectPaymentOutput {
  /**
   * Updated member (with new status and due date)
   */
  member: Member;

  /**
   * Payment record
   */
  payment: Payment;
}

/**
 * Collect Payment Use Case
 *
 * Handles the complete workflow of collecting a payment and renewing membership.
 *
 * @example
 * const collectPayment = new CollectPayment(
 *   memberRepository,
 *   paymentRepository,
 *   smsProvider
 * );
 *
 * const result = await collectPayment.execute({
 *   gymId: 'gym-123',
 *   memberId: 'member-456',
 *   paymentDate: new Date(),
 *   paymentAmount: 2000,
 *   discountId: null,
 *   deductOverduePeriod: true
 * });
 */
export class CollectPayment {
  constructor(
    private readonly memberRepo: IMemberRepository,
    private readonly paymentRepo: IPaymentRepository,
    private readonly smsProvider: ISMSProvider,
    private readonly smsRepo: ISMSRepository
  ) {}

  /**
   * Execute payment collection
   *
   * @param input - Payment collection input
   * @returns Updated member and payment record
   * @throws NotFoundError if member doesn't exist
   * @throws ValidationError if payment amount is invalid
   */
  async execute(input: CollectPaymentInput): Promise<CollectPaymentOutput> {
    // 1. Get member from repository
    const member = await this.memberRepo.findById(input.memberId, input.gymId);

    if (!member) {
      throw new NotFoundError(`Member ${input.memberId}`);
    }

    // 2. Validate payment amount
    if (input.paymentAmount <= 0) {
      throw new ValidationError('Payment amount must be greater than zero');
    }

    // 3. Calculate next due date
    // If deductOverduePeriod is true (default), calculate from payment date
    // If false, calculate from current next_due_date (allows members to pay early)
    const baseDate =
      input.deductOverduePeriod ?? true
        ? input.paymentDate
        : member.nextDueDate;

    const nextDueDate = calculateNextDueDate(baseDate, member.planType, {
      deductOverduePeriod: input.deductOverduePeriod ?? true,
    });

    // 4. Activate or renew member based on current status (state machine enforced)
    // - If member is already Active: renew (early payment/extension)
    // - If member is Expired/Suspended: activate (reactivation)
    // Note: Reminder flags will be reset by the repository when updating a member
    // (this keeps the domain model clean from SMS tracking concerns)
    //
    // ORDER MATTERS: the member flip runs BEFORE the payment insert because a
    // reactivation can be rejected by the active-member quota (DB trigger
    // raises MEMBER_LIMIT_REACHED -> MemberLimitError). Failing here first
    // means a quota block records nothing — no orphaned payment row, and a
    // retry after upgrading cannot double-record the payment.
    const processedMember =
      member.status === 'active'
        ? member.renew(nextDueDate)  // Early renewal for active members
        : member.activate(nextDueDate); // Reactivation for expired/suspended

    const updatedMember = await this.memberRepo.update(processedMember);

    // 5. Create payment record
    const payment = Payment.create({
      memberId: input.memberId,
      gymId: input.gymId,
      paymentDate: input.paymentDate,
      amountPaid: input.paymentAmount,
      discountApplied: input.discount?.discountId || null,
      discountPercentage: input.discount?.discountPercentage || null,
      nextDueDateCalculated: nextDueDate,
    });

    const savedPayment = await this.paymentRepo.create(payment);

    // 6. Send receipt SMS and log it BEFORE returning.
    // On serverless runtimes the function can be frozen as soon as the
    // response is sent, so a fire-and-forget send drops the sms_logs
    // write (and sometimes the SMS itself) mid-flight. sendReceiptSMS
    // handles provider failures internally, so a failed SMS never
    // fails the payment.
    try {
      await this.sendReceiptSMS(
        updatedMember,
        input.paymentAmount,
        nextDueDate,
        input.discount
      );
    } catch (error) {
      console.error('Failed to send receipt SMS:', error);
    }

    return {
      member: updatedMember,
      payment: savedPayment,
    };
  }

  /**
   * Send receipt SMS to member
   *
   * @param member - Member who made payment
   * @param amountPaid - Payment amount
   * @param nextDueDate - Next due date
   * @param discount - Discount information (optional)
   */
  private async sendReceiptSMS(
    member: Member,
    amountPaid: number,
    nextDueDate: Date,
    discount?: DiscountInfo | null
  ): Promise<void> {
    const message = this.generateReceiptMessage(
      member,
      amountPaid,
      nextDueDate,
      discount
    );

    try {
      // Send SMS
      const result = await this.smsProvider.send({
        to: member.phoneNumber,
        message,
      });

      if (result.success) {
        // Log successful SMS to database
        await this.smsRepo.create({
          memberId: member.id,
          gymId: member.gymId,
          smsType: 'receipt',
          phoneNumber: member.phoneNumber,
          messageBody: message,
          sentAt: new Date(),
          deliveryStatus: SMSDeliveryStatus.Sent,
          textLkMessageId: result.messageId || null,
          errorMessage: null,
        });
      } else {
        // Log failed SMS to database with error message
        await this.smsRepo.create({
          memberId: member.id,
          gymId: member.gymId,
          smsType: 'receipt',
          phoneNumber: member.phoneNumber,
          messageBody: message,
          sentAt: new Date(),
          deliveryStatus: SMSDeliveryStatus.Failed,
          textLkMessageId: null,
          errorMessage: result.error || 'Unknown error',
        });
        console.error('Receipt SMS failed:', result.error);
      }
    } catch (error) {
      // Log exception to database
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
          errorMessage: error instanceof Error ? error.message : 'Exception sending SMS',
        });
      } catch (logError) {
        console.error('Failed to log SMS failure:', logError);
      }
      console.error('Exception sending receipt SMS:', error);
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Generate receipt SMS message
   *
   * @param member - Member who made payment
   * @param amountPaid - Payment amount
   * @param nextDueDate - Next due date
   * @param discount - Discount information (optional)
   * @returns SMS message body
   */
  private generateReceiptMessage(
    member: Member,
    amountPaid: number,
    nextDueDate: Date,
    discount?: DiscountInfo | null
  ): string {
    const amountFormatted = `Rs.${amountPaid.toFixed(2)}`;
    const dueDateFormatted = formatDateForDisplay(nextDueDate);

    // Include discount in message if applied
    if (discount?.discountName && discount?.discountPercentage) {
      return (
        `Dear ${member.name}, payment of ${amountFormatted} received ` +
        `(Discount: ${discount.discountName} ${discount.discountPercentage}% applied). ` +
        `Next due date: ${dueDateFormatted}. Thank you!`
      );
    }

    return (
      `Dear ${member.name}, payment of ${amountFormatted} received. ` +
      `Next due date: ${dueDateFormatted}. Thank you!`
    );
  }
}
