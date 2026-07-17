/**
 * Phone number validation and formatting utilities for Sri Lankan phone numbers
 */

/**
 * Normalize phone number to canonical format (94XXXXXXXXX)
 *
 * Accepts various input formats:
 * - 0771234567 → 94771234567
 * - 771234567 → 94771234567
 * - +94771234567 → 94771234567
 * - 94771234567 → 94771234567
 *
 * @param phone - Phone number in any format
 * @param countryCode - Country code (default: '94' for Sri Lanka)
 * @returns Normalized phone number without '+' prefix
 */
export function normalizePhoneNumber(phone: string, countryCode: string = '94'): string {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');

  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');

  // Remove country code if already present
  if (cleaned.startsWith(countryCode)) {
    cleaned = cleaned.substring(countryCode.length);
  }

  // Add country code
  return `${countryCode}${cleaned}`;
}

/**
 * Validate Sri Lankan mobile phone number
 *
 * Valid format: 94 + 9 digits
 * Valid prefixes: 70, 71, 72, 74, 75, 76, 77, 78
 *
 * @param phone - Phone number to validate
 * @returns True if valid Sri Lankan mobile number
 */
export function isValidSriLankanPhone(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);

  // Should be 11 digits: 94 + 9 digits
  if (normalized.length !== 11) return false;

  // Must start with 94
  if (!normalized.startsWith('94')) return false;

  // Valid mobile prefixes in Sri Lanka: 70-78
  const prefix = normalized.substring(2, 4);
  const validPrefixes = ['70', '71', '72', '74', '75', '76', '77', '78'];

  return validPrefixes.includes(prefix);
}

/**
 * Format phone number for display
 *
 * Input: 94771234567
 * Output: (077) 123-4567
 *
 * @param phone - Normalized phone number
 * @returns Formatted phone number for display
 */
export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhoneNumber(phone);

  if (normalized.length !== 11) return phone;

  const areaCode = normalized.substring(2, 4);
  const firstPart = normalized.substring(4, 7);
  const secondPart = normalized.substring(7, 11);

  return `(0${areaCode}) ${firstPart}-${secondPart}`;
}

/**
 * Format phone number for SMS sending (with + prefix)
 *
 * Input: 94771234567 or 0771234567
 * Output: +94771234567
 *
 * @param phone - Phone number in any format
 * @returns Phone number with + prefix
 */
export function formatPhoneForSMS(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  return `+${normalized}`;
}

/**
 * Extract country code from phone number
 *
 * @param phone - Phone number
 * @returns Country code (e.g., '94')
 */
export function extractCountryCode(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');

  // Check if starts with common country codes
  if (cleaned.startsWith('94')) return '94';
  if (cleaned.startsWith('1')) return '1';

  return '94'; // Default to Sri Lanka
}

/**
 * Validate phone number format (generic)
 *
 * @param phone - Phone number to validate
 * @returns True if phone number has valid format
 */
export function isValidPhoneFormat(phone: string): boolean {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  // Should have at least 9 digits and at most 15 digits
  return cleaned.length >= 9 && cleaned.length <= 15;
}
