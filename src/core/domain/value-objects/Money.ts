/**
 * Money Value Object
 *
 * Represents a monetary amount with currency.
 * This is an immutable value object that ensures safe money arithmetic.
 *
 * CRITICAL: This uses integer arithmetic (cents/paisa) internally to avoid
 * floating-point precision issues.
 */

import { ValidationError } from '@/core/utils/errors';

/**
 * Currency codes
 */
export enum Currency {
  LKR = 'LKR', // Sri Lankan Rupee
  USD = 'USD', // US Dollar
}

/**
 * Money Value Object
 *
 * Immutable representation of money with safe arithmetic operations.
 * Internally stores amounts in cents/paisa to avoid floating-point errors.
 *
 * @example
 * // Create money instance
 * const price = Money.fromAmount(2000, Currency.LKR);
 *
 * @example
 * // Arithmetic operations
 * const total = price.add(Money.fromAmount(500));
 * const discounted = price.subtract(Money.fromAmount(200));
 * const doubled = price.multiply(2);
 *
 * @example
 * // Formatting
 * price.format(); // 'LKR 2,000.00'
 * price.getAmount(); // 2000
 */
export class Money {
  /**
   * Amount stored in smallest unit (cents/paisa)
   * This avoids floating-point precision issues
   */
  private readonly amountInCents: number;
  private readonly currency: Currency;

  private constructor(amountInCents: number, currency: Currency) {
    this.amountInCents = amountInCents;
    this.currency = currency;
  }

  /**
   * Create Money from decimal amount
   *
   * @param amount - Amount in major units (e.g., rupees, dollars)
   * @param currency - Currency code
   * @returns Money instance
   * @throws ValidationError if invalid
   */
  static fromAmount(amount: number, currency: Currency = Currency.LKR): Money {
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw ValidationError.fromField('amount', 'Amount must be a valid number');
    }

    if (amount < 0) {
      throw ValidationError.fromField('amount', 'Amount cannot be negative');
    }

    if (!isFinite(amount)) {
      throw ValidationError.fromField('amount', 'Amount must be finite');
    }

    // Convert to cents/paisa (multiply by 100 and round to avoid precision issues)
    const amountInCents = Math.round(amount * 100);

    return new Money(amountInCents, currency);
  }

  /**
   * Create Money from cents/paisa
   *
   * @param amountInCents - Amount in smallest unit
   * @param currency - Currency code
   * @returns Money instance
   */
  static fromCents(amountInCents: number, currency: Currency = Currency.LKR): Money {
    if (!Number.isInteger(amountInCents)) {
      throw ValidationError.fromField('amount', 'Amount in cents must be an integer');
    }

    if (amountInCents < 0) {
      throw ValidationError.fromField('amount', 'Amount cannot be negative');
    }

    return new Money(amountInCents, currency);
  }

  /**
   * Create zero money
   *
   * @param currency - Currency code
   * @returns Money instance with zero amount
   */
  static zero(currency: Currency = Currency.LKR): Money {
    return new Money(0, currency);
  }

  /**
   * Get amount in major units (e.g., rupees, dollars)
   *
   * @returns Decimal amount
   */
  getAmount(): number {
    return this.amountInCents / 100;
  }

  /**
   * Get amount in cents/paisa
   *
   * @returns Integer amount in smallest unit
   */
  getAmountInCents(): number {
    return this.amountInCents;
  }

  /**
   * Get currency
   *
   * @returns Currency code
   */
  getCurrency(): Currency {
    return this.currency;
  }

  /**
   * Check if amount is zero
   *
   * @returns True if zero
   */
  isZero(): boolean {
    return this.amountInCents === 0;
  }

  /**
   * Check if amount is positive
   *
   * @returns True if positive
   */
  isPositive(): boolean {
    return this.amountInCents > 0;
  }

  /**
   * Add two money values
   *
   * @param other - Money to add
   * @returns New Money instance
   * @throws Error if currencies don't match
   */
  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountInCents + other.amountInCents, this.currency);
  }

  /**
   * Subtract money value
   *
   * @param other - Money to subtract
   * @returns New Money instance
   * @throws Error if currencies don't match or result is negative
   */
  subtract(other: Money): Money {
    this.assertSameCurrency(other);

    const result = this.amountInCents - other.amountInCents;
    if (result < 0) {
      throw new ValidationError('Cannot subtract: result would be negative', {
        amount: ['Subtraction result cannot be negative'],
      });
    }

    return new Money(result, this.currency);
  }

  /**
   * Multiply by a factor
   *
   * @param factor - Multiplication factor
   * @returns New Money instance
   */
  multiply(factor: number): Money {
    if (typeof factor !== 'number' || isNaN(factor)) {
      throw ValidationError.fromField('factor', 'Factor must be a valid number');
    }

    if (factor < 0) {
      throw ValidationError.fromField('factor', 'Factor cannot be negative');
    }

    const result = Math.round(this.amountInCents * factor);
    return new Money(result, this.currency);
  }

  /**
   * Calculate percentage
   *
   * @param percentage - Percentage (0-100)
   * @returns New Money instance with calculated amount
   */
  percentage(percentage: number): Money {
    if (percentage < 0 || percentage > 100) {
      throw ValidationError.fromField('percentage', 'Percentage must be between 0 and 100');
    }

    return this.multiply(percentage / 100);
  }

  /**
   * Apply discount percentage
   *
   * @param discountPercentage - Discount percentage (0-100)
   * @returns New Money instance with discount applied
   */
  applyDiscount(discountPercentage: number): Money {
    if (discountPercentage < 0 || discountPercentage > 100) {
      throw ValidationError.fromField('discount', 'Discount must be between 0 and 100');
    }

    const discountAmount = this.percentage(discountPercentage);
    return this.subtract(discountAmount);
  }

  /**
   * Compare with another Money value
   *
   * @param other - Money to compare
   * @returns -1 if less, 0 if equal, 1 if greater
   * @throws Error if currencies don't match
   */
  compareTo(other: Money): number {
    this.assertSameCurrency(other);

    if (this.amountInCents < other.amountInCents) return -1;
    if (this.amountInCents > other.amountInCents) return 1;
    return 0;
  }

  /**
   * Check if equal to another Money value
   *
   * @param other - Money to compare
   * @returns True if equal
   */
  equals(other: Money): boolean {
    return (
      this.amountInCents === other.amountInCents && this.currency === other.currency
    );
  }

  /**
   * Check if greater than another Money value
   *
   * @param other - Money to compare
   * @returns True if greater
   */
  isGreaterThan(other: Money): boolean {
    return this.compareTo(other) > 0;
  }

  /**
   * Check if less than another Money value
   *
   * @param other - Money to compare
   * @returns True if less
   */
  isLessThan(other: Money): boolean {
    return this.compareTo(other) < 0;
  }

  /**
   * Format for display
   *
   * @returns Formatted string (e.g., 'LKR 2,000.00')
   */
  format(): string {
    const amount = this.getAmount();
    return `${this.currency} ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  /**
   * Format for display (short version without currency)
   *
   * @returns Formatted string (e.g., '2,000.00')
   */
  formatShort(): string {
    const amount = this.getAmount();
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /**
   * Convert to string
   *
   * @returns Formatted string
   */
  toString(): string {
    return this.format();
  }

  /**
   * Convert to JSON
   *
   * @returns Object with amount and currency
   */
  toJSON(): { amount: number; currency: string } {
    return {
      amount: this.getAmount(),
      currency: this.currency,
    };
  }

  /**
   * Convert to database format (amount only)
   *
   * @returns Decimal amount
   */
  toDatabase(): number {
    return this.getAmount();
  }

  /**
   * Assert same currency
   *
   * @param other - Other money to compare
   * @throws Error if currencies don't match
   */
  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(
        `Cannot perform operation on different currencies: ${this.currency} and ${other.currency}`
      );
    }
  }
}
