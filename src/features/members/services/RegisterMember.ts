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
 * 5. Welcome SMS sending and logging (awaited, so a serverless freeze after
 *    the response cannot drop the send or its sms_logs row)
 */

import { Member } from '@/features/members/domain/Member'
import { Payment } from '@/features/payments/domain/Payment'
import { PhoneNumber } from '@/utils/phone/PhoneNumber'
import {
  PaymentCalculator,
  type DiscountInfo,
} from '@/features/payments/domain/PaymentCalculator'
import { IMemberRepository } from './IMemberRepository'
import { IPaymentRepository } from '@/features/payments/services/IPaymentRepository'
import { ISMSRepository } from '@/features/sms/services/ISMSRepository'
import { ISMSProvider } from '@/features/sms/services/ISMSProvider'
import { SMSDeliveryStatus } from '@/features/sms/services/ISMSRepository'
import { calculateNextDueDate } from '../utils/calculateNextDueDate'
import { PlanType } from '@/features/members/config/PlanConfig'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { RegistrationSource } from '@/features/members/config/RegistrationConfig'
import { welcomeSms } from '@/features/sms/config/SmsTemplates'
import { ConflictError } from '@/utils/errors'

/**
 * Input for member registration
 */
export interface RegisterMemberInput {
  /**
   * Gym ID (for multi-tenancy)
   */
  gymId: string

  /**
   * The gym's name (`gyms.gym_name`), printed in the welcome SMS. Every
   * automated text names the gym, because the sender ID is platform-wide.
   * Routes already hold it: the desk and bulk routes from the gym profile,
   * the QR route from the gym its token resolves to.
   */
  gymName: string

  /**
   * Member name
   */
  name: string

  /**
   * Phone number (any format: 0771234567, +94771234567, etc.)
   */
  phoneNumber: string

  /**
   * Plan type
   */
  planType: PlanType

  /**
   * Plan amount in LKR
   */
  planAmount: number

  /**
   * Discount ID (optional)
   */
  discountId?: string | null

  /**
   * Whether discount recurs every payment
   */
  recurringDiscount?: boolean

  /**
   * Membership start date
   */
  membershipStartDate: Date

  /**
   * Initial payment amount (may differ from plan amount if discount applied)
   */
  paymentAmount: number

  /**
   * One-off gym admission fee **included in** `paymentAmount` (0 when not
   * charged). Recorded as its own component so the revenue model can keep
   * one-off cash out of a collection rate whose denominator is a membership
   * billing schedule. Both registration paths resolve it server-side from the
   * gym row; it is never taken from client input.
   */
  admissionFee?: number

  /**
   * Discount information (for payment record)
   */
  discount?: DiscountInfo | null

  /**
   * How this member is being registered.
   *
   * - Manual (default): standard front-desk form, considered verified.
   * - Qr: public QR self-registration; shows a NEW badge until the gym
   *   verifies the entry.
   */
  registrationSource?: RegistrationSource

  /**
   * Free-text note (manual desk registration only). Optional.
   */
  remarks?: string | null

  /**
   * When the member accepted Metric's privacy policy & terms of service.
   * Set to the registration time when the consent checkbox was ticked.
   */
  acceptedTermsAt?: Date | null

  /**
   * When the member agreed to the gym's guidelines & rules.
   * Set to the registration time when the consent checkbox was ticked.
   */
  acceptedGymRulesAt?: Date | null
}

/**
 * Output of member registration
 */
export interface RegisterMemberOutput {
  /**
   * Created member
   */
  member: Member

  /**
   * Initial payment record
   */
  payment: Payment
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
 *   gymName: 'Titan Fitness',
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
    const phoneNumber = PhoneNumber.create(input.phoneNumber)

    // 2. Check for duplicate phone number
    const existingMember = await this.memberRepo.findByPhoneNumber(
      phoneNumber.getValue(),
      input.gymId
    )

    if (existingMember) {
      throw new ConflictError(
        `A member with phone number ${phoneNumber.getDisplayValue()} already exists`
      )
    }

    // 3. Calculate next due date from membership start date
    const nextDueDate = calculateNextDueDate(
      input.membershipStartDate,
      input.planType,
      { deductOverduePeriod: true }
    )

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
      remarks: input.remarks ?? null,
      acceptedTermsAt: input.acceptedTermsAt ?? null,
      acceptedGymRulesAt: input.acceptedGymRulesAt ?? null,
    })

    // 5. Persist member through the FOR UPDATE-locked quota gate
    //    (register_member_guarded — the single member-quota authority).
    //    Throws MemberLimitError when the gym's tier blocks the insert.
    const savedMember = await this.memberRepo.createGuarded(input.gymId, member)

    // 6. Create initial payment record
    const payment = Payment.create({
      memberId: savedMember.id,
      gymId: input.gymId,
      paymentDate: input.membershipStartDate,
      amountPaid: input.paymentAmount,
      discountApplied: input.discount?.discountId || null,
      discountPercentage: input.discount?.discountPercentage || null,
      nextDueDateCalculated: nextDueDate,
      admissionFee: input.admissionFee ?? 0,
    })

    const savedPayment = await this.paymentRepo.create(payment)

    // 7. Send the welcome SMS and log it BEFORE returning.
    // On serverless runtimes the function can be frozen as soon as the
    // response is sent. This send used to be fire-and-forget, and about a
    // third of registrations never logged it (rule 2.7). sendWelcomeSMS
    // handles provider failures internally, so a failed SMS never fails the
    // registration. Same pattern as CollectPayment.
    try {
      await this.sendWelcomeSMS(savedMember, input.gymName, input.paymentAmount)
    } catch (error) {
      console.error('Failed to send welcome SMS:', error)
    }

    return {
      member: savedMember,
      payment: savedPayment,
    }
  }

  /**
   * Send welcome SMS to new member
   *
   * @param member - Registered member
   * @param gymName - The gym's name, printed in the text
   * @param amountPaid - Initial payment amount
   */
  private async sendWelcomeSMS(
    member: Member,
    gymName: string,
    amountPaid: number
  ): Promise<void> {
    const message = welcomeSms({
      gymName,
      memberName: member.name,
      planType: member.planType,
      amountPaid,
      nextDueDate: member.nextDueDate,
    })

    try {
      // Send SMS
      const result = await this.smsProvider.send({
        to: member.phoneNumber,
        message,
      })

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
        })
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
        })
        console.error('Welcome SMS failed:', result.error)
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
          errorMessage:
            error instanceof Error ? error.message : 'Exception sending SMS',
        })
      } catch (logError) {
        console.error('Failed to log SMS failure:', logError)
      }
      console.error('Exception sending welcome SMS:', error)
      // Don't throw - this is a non-critical operation
    }
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
    return PaymentCalculator.calculateAmount(planAmount, discount)
  }
}
