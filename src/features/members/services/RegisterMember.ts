/**
 * Register Member Use Case
 *
 * Handles new member registration with initial payment.
 *
 * Extracted from: src/features/members/services/member.service.ts (lines 165-259)
 *
 * This use case orchestrates:
 * 1. Phone number validation
 * 2. Next due date calculation
 * 3. Member creation
 * 4. Initial payment recording
 * 5. Welcome SMS sending
 */

import { Member } from '@/features/members/domain/Member';
import { Payment } from '@/features/payments/domain/Payment';
import { PhoneNumber } from '@/utils/phone/PhoneNumber';
import { PaymentCalculator, type DiscountInfo } from '@/features/payments/domain/PaymentCalculator';
import { IMemberRepository, IPaymentRepository, ISMSRepository } from '@/core/ports/repositories';
import { ISMSProvider } from '@/core/ports/services';
import { SMSDeliveryStatus } from '@/features/sms/services/ISMSRepository';
import { calculateNextDueDate } from '@/core/utils/date';
import { PlanType } from '@/features/members/config/PlanConfig';
import { MemberStatus } from '@/features/members/config/StatusConfig';
import { RegistrationSource } from '@/features/members/config/RegistrationConfig';
import { formatDateForDisplay } from '@/core/utils/date';
import { ConflictError } from '@/utils/errors';

/**
 * Input for member registration
 */
export interface RegisterMemberInput {
  /**
   * Gym ID (for multi-tenancy)
   */
  gymId: string;

  /**
   * Member name
   */
  name: string;

  /**
   * Phone number (any format: 0771234567, +94771234567, etc.)
   */
  phoneNumber: string;

  /**
   * Plan type
   */
  planType: PlanType;

  /**
   * Plan amount in LKR
   */
  planAmount: number;

  /**
   * Discount ID (optional)
   */
  discountId?: string | null;

  /**
   * Whether discount recurs every payment
   */
  recurringDiscount?: boolean;

  /**
   * Membership start date
   */
  membershipStartDate: Date;

  /**
   * Initial payment amount (may differ from plan amount if discount applied)
   */
  paymentAmount: number;

  /**
   * Discount information (for payment record)
   */
  discount?: DiscountInfo | null;

  /**
   * How this member is being registered.
   *
   * - Manual (default): standard front-desk form, considered verified.
   * - Qr: public QR self-registration; shows a NEW badge until the gym
   *   verifies the entry.
   */
  registrationSource?: RegistrationSource;
}

/**
 * Output of member registration
 */
export interface RegisterMemberOutput {
  /**
   * Created member
   */
  member: Member;

  /**
   * Initial payment record
   */
  payment: Payment;
}

/**
 * Register Member Use Case
 *
 * Handles the complete workflow of registering a new member.
 *
 * @example
 * const registerMember = new RegisterMember(
 *   memberRepository,
 *   paymentRepository,
 *   smsProvider
 * );
 *
 * const result = await registerMember.execute({
 *   gymId: 'gym-123',
 *   name: 'John Doe',
 *   phoneNumber: '0771234567',
 *   planType: PlanType.Monthly,
 *   planAmount: 2000,
 *   discountId: null,
 *   recurringDiscount: false,
 *   membershipStartDate: new Date(),
 *   paymentAmount: 2000
 * });
 */
export class RegisterMember {
  constructor(
    private readonly memberRepo: IMemberRepository,
    private readonly paymentRepo: IPaymentRepository,
    private readonly smsProvider: ISMSProvider,
    private readonly smsRepo: ISMSRepository
  ) {}

  /**
   * Execute member registration
   *
   * @param input - Registration input
   * @returns Registered member and payment
   * @throws ConflictError if phone number already exists
   * @throws ValidationError if input is invalid
   */
  async execute(input: RegisterMemberInput): Promise<RegisterMemberOutput> {
    // 1. Validate and normalize phone number
    const phoneNumber = PhoneNumber.create(input.phoneNumber);

    // 2. Check for duplicate phone number
    const existingMember = await this.memberRepo.findByPhoneNumber(
      phoneNumber.getValue(),
      input.gymId
    );

    if (existingMember) {
      throw new ConflictError(
        `A member with phone number ${phoneNumber.getDisplayValue()} already exists`
      );
    }

    // 3. Calculate next due date from membership start date
    const nextDueDate = calculateNextDueDate(
      input.membershipStartDate,
      input.planType,
      { deductOverduePeriod: true }
    );

    // 4. Create member entity
    const member = Member.create({
      gymId: input.gymId,
      name: input.name.trim(),
      phoneNumber: phoneNumber.getValue(),
      planType: input.planType,
      planAmount: input.planAmount,
      discountId: input.discountId || null,
      recurringDiscount: input.recurringDiscount || false,
      status: MemberStatus.Active,
      registeredDate: input.membershipStartDate,
      membershipStartDate: input.membershipStartDate,
      nextDueDate: nextDueDate,
      registrationSource: input.registrationSource ?? RegistrationSource.Manual,
    });

    // 5. Persist member through the FOR UPDATE-locked quota gate
    //    (register_member_guarded — the single member-quota authority).
    //    Throws MemberLimitError when the gym's tier blocks the insert.
    const savedMember = await this.memberRepo.createGuarded(input.gymId, member);

    // 6. Create initial payment record
    const payment = Payment.create({
      memberId: savedMember.id,
      gymId: input.gymId,
      paymentDate: input.membershipStartDate,
      amountPaid: input.paymentAmount,
      discountApplied: input.discount?.discountId || null,
      discountPercentage: input.discount?.discountPercentage || null,
      nextDueDateCalculated: nextDueDate,
    });

    const savedPayment = await this.paymentRepo.create(payment);

    // 7. Send welcome SMS (fire-and-forget)
    // We don't await this to avoid blocking the response
    this.sendWelcomeSMS(savedMember, input.paymentAmount).catch((error) => {
      console.error('Failed to send welcome SMS:', error);
      // TODO: Log to monitoring service
    });

    return {
      member: savedMember,
      payment: savedPayment,
    };
  }

  /**
   * Send welcome SMS to new member
   *
   * @param member - Registered member
   * @param amountPaid - Initial payment amount
   */
  private async sendWelcomeSMS(member: Member, amountPaid: number): Promise<void> {
    const message = this.generateWelcomeMessage(member, amountPaid);

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
          smsType: 'welcome',
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
          smsType: 'welcome',
          phoneNumber: member.phoneNumber,
          messageBody: message,
          sentAt: new Date(),
          deliveryStatus: SMSDeliveryStatus.Failed,
          textLkMessageId: null,
          errorMessage: result.error || 'Unknown error',
        });
        console.error('Welcome SMS failed:', result.error);
      }
    } catch (error) {
      // Log exception to database
      try {
        await this.smsRepo.create({
          memberId: member.id,
          gymId: member.gymId,
          smsType: 'welcome',
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
      console.error('Exception sending welcome SMS:', error);
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Generate welcome SMS message
   *
   * @param member - Registered member
   * @param amountPaid - Initial payment amount
   * @returns SMS message body
   */
  private generateWelcomeMessage(member: Member, amountPaid: number): string {
    const planTypeLabel = member.planType.replace('-', ' ');
    const nextDueFormatted = formatDateForDisplay(member.nextDueDate);
    const amountFormatted = `Rs.${amountPaid.toFixed(2)}`;

    return (
      `Welcome to our gym, ${member.name}! ` +
      `Your ${planTypeLabel} membership is active. ` +
      `Amount paid: ${amountFormatted}. ` +
      `Next due: ${nextDueFormatted}. ` +
      `Thank you!`
    );
  }

  /**
   * Calculate payment amount with discount
   *
   * Helper method for API layer to calculate final amount.
   *
   * @param planAmount - Base plan amount
   * @param discount - Discount information
   * @returns Final payment amount
   */
  static calculatePaymentAmount(
    planAmount: number,
    discount: DiscountInfo | null
  ): number {
    return PaymentCalculator.calculateAmount(planAmount, discount);
  }
}
