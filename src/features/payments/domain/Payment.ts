/**
 * Payment Domain Entity
 *
 * Represents a payment transaction made by a member.
 * This is primarily a value object / transaction record with minimal business logic.
 */

/**
 * Kind of payment being recorded
 *
 * - plan_payment: regular plan registration/renewal payment
 * - day_pass: single-day access fee (e.g. expired member visiting for a day)
 */
export enum PaymentType {
  PlanPayment = 'plan_payment',
  DayPass = 'day_pass',
}

/**
 * Payment properties interface
 */
export interface PaymentProps {
  id: string
  memberId: string
  gymId: string
  paymentDate: Date
  amountPaid: number
  discountApplied: string | null
  discountPercentage: number | null
  nextDueDateCalculated: Date
  createdAt: Date

  /**
   * Kind of payment. Optional for backward compatibility; normalized to
   * PlanPayment in the constructor.
   */
  paymentType?: PaymentType

  /**
   * One-off gym admission fee **included in** `amountPaid` (0 when not charged).
   *
   * A component, not an addition: `amountPaid` remains the total the member
   * handed over, and plan revenue is `amountPaid - admissionFee`. Separating it
   * lets the revenue model keep one-off cash out of a collection rate whose
   * denominator is a billing schedule that could never predict it.
   *
   * Optional for backward compatibility; normalized to 0 in the constructor.
   */
  admissionFee?: number
}

/**
 * Properties for creating a new payment
 */
export type CreatePaymentProps = Omit<PaymentProps, 'id' | 'createdAt'>

/**
 * Payment domain entity
 *
 * Represents a payment record in the system.
 * Payments are immutable once created (no updates, only creation).
 *
 * @example
 * const payment = Payment.create({
 *   memberId: 'member-123',
 *   gymId: 'gym-456',
 *   paymentDate: new Date(),
 *   amountPaid: 2000,
 *   discountApplied: 'STUDENT10',
 *   discountPercentage: 10,
 *   nextDueDateCalculated: new Date('2024-02-15')
 * });
 */
export class Payment {
  private readonly props: PaymentProps

  private constructor(props: PaymentProps) {
    // Validate required fields
    if (!props.memberId) throw new Error('memberId is required')
    if (!props.gymId) throw new Error('gymId is required')
    if (props.amountPaid <= 0) throw new Error('amountPaid must be positive')

    const admissionFee = props.admissionFee ?? 0
    if (admissionFee < 0) throw new Error('admissionFee cannot be negative')
    // The fee is part of the total, so it can never exceed it. Catching this
    // here rather than at the database CHECK keeps plan revenue
    // (`amountPaid - admissionFee`) from ever going negative.
    if (admissionFee > props.amountPaid) {
      throw new Error('admissionFee cannot exceed amountPaid')
    }

    this.props = {
      ...props,
      paymentType: props.paymentType ?? PaymentType.PlanPayment,
      admissionFee,
    }
  }

  // ============================================================
  // FACTORY METHODS
  // ============================================================

  /**
   * Create a new payment instance
   *
   * @param props - Payment creation properties
   * @returns New Payment instance
   */
  static create(props: CreatePaymentProps): Payment {
    return new Payment({
      ...props,
      id: '', // Will be assigned by repository
      createdAt: new Date(),
    })
  }

  /**
   * Reconstitute payment from database
   *
   * @param props - Complete payment properties from database
   * @returns Payment instance
   */
  static fromDatabase(props: PaymentProps): Payment {
    return new Payment(props)
  }

  // ============================================================
  // GETTERS
  // ============================================================

  get id(): string {
    return this.props.id
  }

  get memberId(): string {
    return this.props.memberId
  }

  get gymId(): string {
    return this.props.gymId
  }

  get paymentDate(): Date {
    return this.props.paymentDate
  }

  get amountPaid(): number {
    return this.props.amountPaid
  }

  get discountApplied(): string | null {
    return this.props.discountApplied
  }

  get discountPercentage(): number | null {
    return this.props.discountPercentage
  }

  get nextDueDateCalculated(): Date {
    return this.props.nextDueDateCalculated
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get paymentType(): PaymentType {
    return this.props.paymentType ?? PaymentType.PlanPayment
  }

  /** One-off admission fee included in {@link amountPaid} (0 when not charged). */
  get admissionFee(): number {
    return this.props.admissionFee ?? 0
  }

  /**
   * The part of this payment a membership schedule predicts — i.e. everything
   * except the one-off admission fee. This is the figure the revenue collection
   * rate is built from.
   */
  get planAmountPaid(): number {
    return this.amountPaid - this.admissionFee
  }

  /**
   * Check if this payment is a day pass
   *
   * @returns True if payment type is DayPass
   */
  isDayPass(): boolean {
    return this.paymentType === PaymentType.DayPass
  }

  // ============================================================
  // DOMAIN METHODS
  // ============================================================

  /**
   * Check if discount was applied to this payment
   *
   * @returns True if discount was applied
   */
  hasDiscount(): boolean {
    return (
      this.props.discountApplied !== null &&
      this.props.discountPercentage !== null
    )
  }

  /**
   * Get discount amount
   *
   * @returns Discount amount in LKR
   */
  getDiscountAmount(): number {
    if (!this.hasDiscount() || !this.props.discountPercentage) {
      return 0
    }

    // Calculate original amount before discount
    const discountMultiplier = 1 - this.props.discountPercentage / 100
    const originalAmount = this.props.amountPaid / discountMultiplier
    return originalAmount - this.props.amountPaid
  }

  /**
   * Get original amount before discount
   *
   * @returns Original amount in LKR
   */
  getOriginalAmount(): number {
    if (!this.hasDiscount() || !this.props.discountPercentage) {
      return this.props.amountPaid
    }

    const discountMultiplier = 1 - this.props.discountPercentage / 100
    return this.props.amountPaid / discountMultiplier
  }

  // ============================================================
  // PERSISTENCE METHODS
  // ============================================================

  /**
   * Convert to database representation
   *
   * @returns Payment properties for database storage
   */
  toDatabase(): PaymentProps {
    return { ...this.props }
  }

  // ============================================================
  // UTILITY METHODS
  // ============================================================

  /**
   * Compare with another payment
   *
   * @param other - Other payment to compare
   * @returns True if same payment (by ID)
   */
  equals(other: Payment): boolean {
    return this.props.id === other.props.id
  }

  /**
   * Create a plain object representation
   *
   * @returns Plain object with all properties
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      memberId: this.props.memberId,
      gymId: this.props.gymId,
      paymentDate: this.props.paymentDate.toISOString(),
      amountPaid: this.props.amountPaid,
      discountApplied: this.props.discountApplied,
      discountPercentage: this.props.discountPercentage,
      nextDueDateCalculated: this.props.nextDueDateCalculated.toISOString(),
      createdAt: this.props.createdAt.toISOString(),
    }
  }
}
