/**
 * Payment Calculator
 *
 * Centralized payment calculation logic for discounts and amounts.
 * This ensures consistent calculations across the application.
 */

import { PaymentCalculationError } from '@/utils/errors';

/**
 * Discount information
 */
export interface DiscountInfo {
  discountId: string;
  discountPercentage: number;
  discountName: string;
}

/**
 * Payment calculation result
 */
export interface PaymentCalculationResult {
  /**
   * Original amount before discount
   */
  originalAmount: number;

  /**
   * Discount amount in LKR
   */
  discountAmount: number;

  /**
   * Final amount to pay after discount
   */
  finalAmount: number;

  /**
   * Discount percentage applied
   */
  discountPercentage: number;
}

/**
 * Payment Calculator Service
 *
 * Provides static methods for payment calculations.
 * All payment-related calculations should use this service.
 *
 * @example
 * // Calculate amount with discount
 * const result = PaymentCalculator.calculateWithDiscount(2000, {
 *   discountId: 'STUDENT10',
 *   discountPercentage: 10,
 *   discountName: 'Student Discount'
 * });
 * console.log(result.finalAmount); // 1800
 *
 * @example
 * // Calculate amount without discount
 * const amount = PaymentCalculator.calculateAmount(2000, null);
 * console.log(amount); // 2000
 */
export class PaymentCalculator {
  /**
   * Calculate final payment amount
   *
   * @param planAmount - Base plan amount
   * @param discount - Discount to apply (null if no discount)
   * @returns Final amount to pay
   */
  static calculateAmount(planAmount: number, discount: DiscountInfo | null): number {
    if (!discount || discount.discountPercentage === 0) {
      return planAmount;
    }

    return this.calculateWithDiscount(planAmount, discount).finalAmount;
  }

  /**
   * Calculate payment with discount details
   *
   * @param planAmount - Base plan amount
   * @param discount - Discount to apply
   * @returns Detailed calculation result
   */
  static calculateWithDiscount(
    planAmount: number,
    discount: DiscountInfo
  ): PaymentCalculationResult {
    this.validateAmount(planAmount);
    this.validateDiscount(discount);

    const discountAmount = (planAmount * discount.discountPercentage) / 100;
    const finalAmount = planAmount - discountAmount;

    return {
      originalAmount: planAmount,
      discountAmount,
      finalAmount: Math.round(finalAmount * 100) / 100, // Round to 2 decimals
      discountPercentage: discount.discountPercentage,
    };
  }

  /**
   * Calculate discount amount
   *
   * @param planAmount - Base plan amount
   * @param discountPercentage - Discount percentage (0-100)
   * @returns Discount amount in LKR
   */
  static calculateDiscountAmount(planAmount: number, discountPercentage: number): number {
    this.validateAmount(planAmount);

    if (discountPercentage < 0 || discountPercentage > 100) {
      throw new PaymentCalculationError(
        `Discount percentage must be between 0 and 100, got ${discountPercentage}`
      );
    }

    return (planAmount * discountPercentage) / 100;
  }

  /**
   * Calculate original amount from discounted amount
   *
   * This is useful when you know the final amount and need to reverse-calculate.
   *
   * @param discountedAmount - Amount after discount
   * @param discountPercentage - Discount percentage that was applied
   * @returns Original amount before discount
   */
  static calculateOriginalAmount(
    discountedAmount: number,
    discountPercentage: number
  ): number {
    this.validateAmount(discountedAmount);

    if (discountPercentage < 0 || discountPercentage > 100) {
      throw new PaymentCalculationError(
        `Discount percentage must be between 0 and 100, got ${discountPercentage}`
      );
    }

    if (discountPercentage === 100) {
      throw new PaymentCalculationError('Cannot calculate original amount with 100% discount');
    }

    const discountMultiplier = 1 - discountPercentage / 100;
    return discountedAmount / discountMultiplier;
  }

  /**
   * Validate payment amount
   *
   * @param amount - Amount to validate
   * @throws PaymentCalculationError if invalid
   */
  static validateAmount(amount: number): void {
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new PaymentCalculationError('Payment amount must be a valid number');
    }

    if (amount < 0) {
      throw new PaymentCalculationError('Payment amount cannot be negative');
    }

    if (amount === 0) {
      throw new PaymentCalculationError('Payment amount cannot be zero');
    }

    if (!isFinite(amount)) {
      throw new PaymentCalculationError('Payment amount must be finite');
    }
  }

  /**
   * Validate discount information
   *
   * @param discount - Discount to validate
   * @throws PaymentCalculationError if invalid
   */
  static validateDiscount(discount: DiscountInfo): void {
    if (!discount.discountId) {
      throw new PaymentCalculationError('Discount ID is required');
    }

    if (typeof discount.discountPercentage !== 'number' || isNaN(discount.discountPercentage)) {
      throw new PaymentCalculationError('Discount percentage must be a valid number');
    }

    if (discount.discountPercentage < 0 || discount.discountPercentage > 100) {
      throw new PaymentCalculationError(
        `Discount percentage must be between 0 and 100, got ${discount.discountPercentage}`
      );
    }
  }

  /**
   * Format amount for display
   *
   * @param amount - Amount to format
   * @returns Formatted amount string (e.g., "LKR 2,000.00")
   */
  static formatAmount(amount: number): string {
    return `LKR ${amount.toLocaleString('en-LK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  /**
   * Round amount to 2 decimal places
   *
   * @param amount - Amount to round
   * @returns Rounded amount
   */
  static roundAmount(amount: number): number {
    return Math.round(amount * 100) / 100;
  }
}
