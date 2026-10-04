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
 * 3. Applying an optional plan change (reactivation may switch the plan)
 * 4. Calculating next due date (with deductOverduePeriod option)
 * 5. Activating/renewing member (state machine + active-member quota enforced;
 *    a quota block fails BEFORE any write — see step-5 comment in execute())
 * 6. Creating payment record
 * 7. Resetting reminder flags for new billing period
 * 8. Sending the payment SMS and logging it (awaited so serverless
 *    freeze after the response cannot drop the sms_logs write) — the
 *    reactivation template for suspended/cancelled -> active, else the receipt
 */

import { Member, MemberStatus } from '@/features/members/domain/Member'
import { Payment } from '@/features/payments/domain/Payment'
import { PlanType } from '@/features/members/config/PlanConfig'
import { IMemberRepository } from '@/features/members/services/IMemberRepository'
import { IPaymentRepository } from './IPaymentRepository'
import { ISMSRepository } from '@/features/sms/services/ISMSRepository'
import { ISMSProvider } from '@/features/sms/services/ISMSProvider'
import {
  SMSDeliveryStatus,
  type SMSType,
} from '@/features/sms/services/ISMSRepository'
import { calculateNextDueDate } from '@/features/members/utils/calculateNextDueDate'
import { receiptSms, welcomeBackSms } from '@/features/sms/config/SmsTemplates'
import { NotFoundError, ValidationError } from '@/utils/errors'

/**
 * Discount information for payment
 */
export interface DiscountInfo {
  /**
   * Discount ID
   */
  discountId: string

  /**
   * Discount name (for display)
   */
  discountName: string

  /**
   * Discount percentage (0-100)
   */
  discountPercentage: number
}

/**
 * Input for payment collection
 */
export interface CollectPaymentInput {
  /**
   * Gym ID (for multi-tenancy)
   */
  gymId: string

  /**
   * The gym's name (`gyms.gym_name`), printed in the receipt or welcome-back
   * SMS. Every automated text names the gym; the sender ID is platform-wide.
   */
  gymName: string

  /**
   * Member ID
   */
  memberId: string

  /**
   * Payment date
   */
  paymentDate: Date

  /**
   * Payment amount in LKR
   */
  paymentAmount: number

  /**
   * Discount ID (optional)
   */
  discountId?: string | null

  /**
   * Discount information (for receipt)
   */
  discount?: DiscountInfo | null

  /**
   * Whether to deduct overdue period when calculating next due date
   *
   * - true (default): Calculate from payment date (recommended)
   * - false: Calculate from current next_due_date (legacy behavior)
   *
   * @default true
   */
  deductOverduePeriod?: boolean

  /**
   * New plan type to switch the member onto as part of this payment.
   *
   * Used by the reactivation flow, where the operator may change the plan when
   * bringing a cancelled/suspended member back. When provided, the member's plan
   * is updated BEFORE the next due date is calculated (so the new plan's
   * duration drives the due date) and BEFORE the status flip. Omit to keep the
   * member's existing plan (regular "mark paid" behavior).
   */
  planType?: PlanType

  /**
   * New recurring plan base amount (LKR) to persist on the member alongside
   * `planType`. Only applied when `planType` is provided; defaults to the
   * member's current plan amount when omitted. This is the recurring price
   * stored on the member, distinct from `paymentAmount` (what is collected now).
   */
  planAmount?: number
}

/**
 * Output of payment collection
 */
export interface CollectPaymentOutput {
  /**
   * Updated member (with new status and due date)
   */
  member: Member

  /**
   * Payment record
   */
  payment: Payment
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
 *   gymName: 'Titan Fitness',
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
    const member = await this.memberRepo.findById(input.memberId, input.gymId)

    if (!member) {
      throw new NotFoundError(`Member ${input.memberId}`)
    }

    // 2. Validate payment amount
    if (input.paymentAmount <= 0) {
      throw new ValidationError('Payment amount must be greater than zero')
    }

    // Capture the status BEFORE the flip so we can pick the right SMS template:
    // bringing a suspended/cancelled member back is a "reactivation", whereas a
    // paying active/expired member gets the usual payment receipt.
    const wasReactivation =
      member.status === MemberStatus.Suspended ||
      member.status === MemberStatus.Cancelled

    // 3. Apply an optional plan change (reactivation may switch the plan).
    // Done first so the new plan's duration drives the next due date and the
    // updated plan is carried through the single memberRepo.update() below.
    const planChangedMember =
      input.planType !== undefined
        ? member.updatePlan(
            input.planType,
            input.planAmount ?? member.planAmount
          )
        : member

    // 4. Calculate next due date
    // If deductOverduePeriod is true (default), calculate from payment date
    // If false, calculate from current next_due_date (allows members to pay early)
    const baseDate =
      (input.deductOverduePeriod ?? true)
        ? input.paymentDate
        : planChangedMember.nextDueDate

    const nextDueDate = calculateNextDueDate(
      baseDate,
      planChangedMember.planType,
      {
        deductOverduePeriod: input.deductOverduePeriod ?? true,
      }
    )

    // 5. Activate or renew member based on current status (state machine enforced)
    // - If member is already Active: renew (early payment/extension)
    // - If member is Expired/Suspended/Cancelled: activate (reactivation)
    // Note: Reminder flags will be reset by the repository when updating a member
    // (this keeps the domain model clean from SMS tracking concerns)
    //
    // ORDER MATTERS: the member flip runs BEFORE the payment insert because a
    // reactivation can be rejected by the active-member quota (DB trigger
    // raises MEMBER_LIMIT_REACHED -> MemberLimitError). Failing here first
    // means a quota block records nothing — no orphaned payment row, and a
    // retry after upgrading cannot double-record the payment.
    const processedMember =
      planChangedMember.status === MemberStatus.Active
        ? planChangedMember.renew(nextDueDate) // Early renewal for active members
        : planChangedMember.activate(nextDueDate) // Reactivation for expired/suspended/cancelled

    // Optimistic concurrency: only apply if the member's due date is still the
    // one this payment was computed against. Two concurrent "Mark Paid"
    // submissions previously both succeeded — both read the same due date, both
    // computed the same next one, both wrote a payment row. The second now gets
    // a ConflictError (409) and records nothing.
    //
    // Ordered before the payment insert for the same reason the quota check is:
    // a rejected flip must leave no payment behind.
    const updatedMember = await this.memberRepo.update(processedMember, {
      expectedNextDueDate: member.nextDueDate,
    })

    // 6. Create payment record
    const payment = Payment.create({
      memberId: input.memberId,
      gymId: input.gymId,
      paymentDate: input.paymentDate,
      amountPaid: input.paymentAmount,
      discountApplied: input.discount?.discountId || null,
      discountPercentage: input.discount?.discountPercentage || null,
      nextDueDateCalculated: nextDueDate,
    })

    const savedPayment = await this.paymentRepo.create(payment)

    // 7. Send the payment SMS and log it BEFORE returning.
    // On serverless runtimes the function can be frozen as soon as the
    // response is sent, so a fire-and-forget send drops the sms_logs
    // write (and sometimes the SMS itself) mid-flight. sendPaymentSMS
    // handles provider failures internally, so a failed SMS never
    // fails the payment. A reactivation (suspended/cancelled -> active)
    // gets the reactivation template; everything else gets the receipt.
    try {
      await this.sendPaymentSMS(
        updatedMember,
        input.gymName,
        input.paymentAmount,
        nextDueDate,
        input.discount,
        wasReactivation
      )
    } catch (error) {
      console.error('Failed to send payment SMS:', error)
    }

    return {
      member: updatedMember,
      payment: savedPayment,
    }
  }

  /**
   * Send the payment SMS to the member and log it.
   *
   * Chooses the template by whether this payment reactivated the member:
   * - reactivation (suspended/cancelled -> active): "welcome back" message
   * - otherwise: standard payment receipt
   *
   * @param member - Member who made payment
   * @param gymName - The gym's name, printed in the text
   * @param amountPaid - Payment amount
   * @param nextDueDate - Next due date
   * @param discount - Discount information (optional)
   * @param isReactivation - True when the payment brought the member back to active
   */
  private async sendPaymentSMS(
    member: Member,
    gymName: string,
    amountPaid: number,
    nextDueDate: Date,
    discount: DiscountInfo | null | undefined,
    isReactivation: boolean
  ): Promise<void> {
    const smsType: SMSType = isReactivation ? 'reactivation' : 'receipt'
    let message = ''

    try {
      // Built inside the try: a template that throws is a logged failure,
      // never a silently skipped text (rule 2.7).
      message = isReactivation
        ? welcomeBackSms({
            gymName,
            memberName: member.name,
            amountPaid,
            nextDueDate,
          })
        : receiptSms({
            gymName,
            memberName: member.name,
            amountPaid,
            nextDueDate,
            discount:
              discount?.discountName && discount.discountPercentage
                ? {
                    name: discount.discountName,
                    percentage: discount.discountPercentage,
                  }
                : null,
          })

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
          smsType,
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
          smsType,
          phoneNumber: member.phoneNumber,
          messageBody: message,
          sentAt: new Date(),
          deliveryStatus: SMSDeliveryStatus.Failed,
          textLkMessageId: null,
          errorMessage: result.error || 'Unknown error',
        })
        console.error('Payment SMS failed:', result.error)
      }
    } catch (error) {
      // Log exception to database
      try {
        await this.smsRepo.create({
          memberId: member.id,
          gymId: member.gymId,
          smsType,
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
      console.error('Exception sending payment SMS:', error)
      // Don't throw - this is a non-critical operation
    }
  }
}
