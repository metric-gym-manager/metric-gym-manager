/**
 * Phone Number Utilities for Sri Lankan Phone Numbers
 *
 * Provides normalization and validation for Sri Lankan phone numbers
 * Standard format: +94XXXXXXXXX (12 characters total)
 *
 * @module phone.utils
 */

/**
 * Normalizes Sri Lankan phone numbers to +94XXXXXXXXX format
 *
 * Handles multiple input formats:
 * - 0771234567 (10 digits starting with 0)  → +94771234567
 * - 771234567 (9 digits)                     → +94771234567
 * - 94771234567 (11 digits, missing +)       → +94771234567
 * - +94771234567 (already normalized)        → +94771234567
 * - "077 123 4567" (with spaces)             → +94771234567
 * - "077-123-4567" (with hyphens)            → +94771234567
 *
 * @param phone - Raw phone number input
 * @returns Normalized phone number in +94XXXXXXXXX format, or null if invalid
 *
 * @example
 * normalizePhoneNumber('0771234567')   // Returns: '+94771234567'
 * normalizePhoneNumber('771234567')    // Returns: '+94771234567'
 * normalizePhoneNumber('94771234567')  // Returns: '+94771234567'
 * normalizePhoneNumber('+94771234567') // Returns: '+94771234567'
 * normalizePhoneNumber('077 123 4567') // Returns: '+94771234567'
 * normalizePhoneNumber('invalid')      // Returns: null
 */
export function normalizePhoneNumber(phone: string): string | null {
  if (!phone || typeof phone !== 'string') {
    return null;
  }

  // Remove all whitespace, hyphens, and parentheses
  const cleaned = phone.replace(/[\s\-()]/g, '');

  // Pattern 1: 0XXXXXXXXX (10 digits starting with 0)
  // Example: 0771234567
  if (/^0\d{9}$/.test(cleaned)) {
    return `+94${cleaned.substring(1)}`;
  }

  // Pattern 2: XXXXXXXXX (9 digits, no leading 0 or country code)
  // Example: 771234567
  if (/^\d{9}$/.test(cleaned)) {
    return `+94${cleaned}`;
  }

  // Pattern 3: +94XXXXXXXXX (already normalized - 12 characters)
  // Example: +94771234567
  if (/^\+94\d{9}$/.test(cleaned)) {
    return cleaned;
  }

  // Pattern 4: 94XXXXXXXXX (11 digits, missing +)
  // Example: 94771234567
  if (/^94\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // Invalid format
  return null;
}

/**
 * Validates if a phone number is in the correct Sri Lankan format
 *
 * Checks for exact format: +94XXXXXXXXX (12 characters)
 *
 * @param phone - Phone number to validate
 * @returns true if valid Sri Lankan phone number, false otherwise
 *
 * @example
 * isValidSriLankanPhone('+94771234567') // Returns: true
 * isValidSriLankanPhone('0771234567')   // Returns: false (not normalized)
 * isValidSriLankanPhone('+1234567890')  // Returns: false (wrong country code)
 */
export function isValidSriLankanPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // Exact format: +94 followed by exactly 9 digits
  return /^\+94\d{9}$/.test(phone);
}

/**
 * Formats a normalized phone number for display
 *
 * Converts +94771234567 to +94 77 123 4567 for better readability
 *
 * @param phone - Normalized phone number (+94XXXXXXXXX)
 * @returns Formatted phone number with spaces, or original if invalid
 *
 * @example
 * formatPhoneForDisplay('+94771234567') // Returns: '+94 77 123 4567'
 */
export function formatPhoneForDisplay(phone: string): string {
  if (!isValidSriLankanPhone(phone)) {
    return phone; // Return as-is if not valid
  }

  // Format: +94 XX XXX XXXX
  return `${phone.slice(0, 3)} ${phone.slice(3, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`;
}

/**
 * Masks a phone number for privacy
 *
 * Converts +94771234567 to +94 XX XXX X567
 * Shows first 2 and last 3 digits only
 *
 * @param phone - Normalized phone number (+94XXXXXXXXX)
 * @returns Masked phone number
 *
 * @example
 * maskPhoneNumber('+94771234567') // Returns: '+94 77 XXX X567'
 */
export function maskPhoneNumber(phone: string): string {
  if (!isValidSriLankanPhone(phone)) {
    return 'Invalid phone';
  }

  // Format: +94 XX XXX XXXX (show first 2 and last 3 digits)
  const firstTwo = phone.slice(3, 5);
  const lastThree = phone.slice(-3);

  return `+94 ${firstTwo} XXX X${lastThree}`;
}
