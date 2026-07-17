/**
 * PhoneNumber Value Object
 *
 * Represents a validated Sri Lankan phone number.
 * This is an immutable value object that ensures phone number validity.
 */

import { ValidationError } from '@/utils/errors';
import {
  normalizePhoneNumber,
  isValidSriLankanPhone,
  formatPhoneDisplay,
  formatPhoneForSMS,
} from '@/utils/phone/phone';

/**
 * Phone Number Value Object
 *
 * Immutable representation of a validated phone number.
 * All phone numbers are stored in normalized format (+94XXXXXXXXX).
 *
 * @example
 * // Create from various formats
 * const phone1 = PhoneNumber.create('0771234567');
 * const phone2 = PhoneNumber.create('+94771234567');
 * const phone3 = PhoneNumber.create('771234567');
 *
 * @example
 * // Get different formats
 * phone1.getValue(); // '+94771234567'
 * phone1.getDisplayValue(); // '(077) 123-4567'
 * phone1.getSMSFormat(); // '+94771234567'
 *
 * @example
 * // Comparison
 * phone1.equals(phone2); // true (same number)
 */
export class PhoneNumber {
  private readonly value: string;

  private constructor(phoneNumber: string) {
    this.value = phoneNumber;
  }

  /**
   * Create a PhoneNumber from various input formats
   *
   * Accepts:
   * - Local format: 0771234567
   * - International format: +94771234567
   * - Without leading zero: 771234567
   *
   * @param phoneNumber - Phone number in any format
   * @returns PhoneNumber instance
   * @throws ValidationError if invalid
   */
  static create(phoneNumber: string): PhoneNumber {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      throw ValidationError.fromField('phoneNumber', 'Phone number is required');
    }

    // Validate Sri Lankan phone number format
    if (!isValidSriLankanPhone(phoneNumber)) {
      throw ValidationError.fromField(
        'phoneNumber',
        'Invalid Sri Lankan phone number. Valid format: 0771234567',
        'Must start with 077, 076, 075, 074, 072, 071, or 070'
      );
    }

    // Normalize to +94XXXXXXXXX format
    const normalized = normalizePhoneNumber(phoneNumber);
    const withPlus = `+${normalized}`;

    return new PhoneNumber(withPlus);
  }

  /**
   * Create from database value
   *
   * Assumes the value is already validated and normalized.
   *
   * @param phoneNumber - Phone number from database
   * @returns PhoneNumber instance
   */
  static fromDatabase(phoneNumber: string): PhoneNumber {
    // Database should always have normalized format
    // But we still validate to be safe
    return PhoneNumber.create(phoneNumber);
  }

  /**
   * Get the normalized value (+94XXXXXXXXX)
   *
   * This is the format used for storage and SMS sending.
   *
   * @returns Phone number with + prefix
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Get display-friendly format
   *
   * Returns: (077) 123-4567
   *
   * @returns Formatted phone number for display
   */
  getDisplayValue(): string {
    return formatPhoneDisplay(this.value);
  }

  /**
   * Get SMS format (+94XXXXXXXXX)
   *
   * This is the format required by SMS providers.
   *
   * @returns Phone number with + prefix
   */
  getSMSFormat(): string {
    return formatPhoneForSMS(this.value);
  }

  /**
   * Get local format (0XXXXXXXXX)
   *
   * Returns: 0771234567
   *
   * @returns Phone number with leading zero
   */
  getLocalFormat(): string {
    // Remove +94 and add 0
    return '0' + this.value.substring(3);
  }

  /**
   * Get area code
   *
   * Returns: 77 (from 0771234567)
   *
   * @returns Two-digit area code
   */
  getAreaCode(): string {
    return this.value.substring(3, 5);
  }

  /**
   * Check if this phone number equals another
   *
   * @param other - Other phone number to compare
   * @returns True if same phone number
   */
  equals(other: PhoneNumber): boolean {
    return this.value === other.value;
  }

  /**
   * Convert to string (for logging)
   *
   * @returns Normalized phone number value
   */
  toString(): string {
    return this.value;
  }

  /**
   * Convert to JSON (for serialization)
   *
   * @returns Normalized phone number value
   */
  toJSON(): string {
    return this.value;
  }

  /**
   * Convert to database format
   *
   * @returns Normalized phone number for storage
   */
  toDatabase(): string {
    return this.value;
  }
}
