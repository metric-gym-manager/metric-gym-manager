/**
 * Unit Tests for Phone Number Utilities
 *
 * Tests cover:
 * - Phone number normalization (multiple input formats)
 * - Sri Lankan phone number validation
 * - Phone number formatting for display
 * - Phone number masking for privacy
 * - Edge cases and error handling
 *
 * Target: 100% coverage (pure functions)
 */

import { describe, it, expect } from '@jest/globals';
import {
  normalizePhoneNumber,
  isValidSriLankanPhone,
  formatPhoneForDisplay,
  maskPhoneNumber,
} from '../phone.utils';

describe('Phone Utils - normalizePhoneNumber', () => {
  it('should normalize 10-digit number starting with 0', () => {
    const result = normalizePhoneNumber('0771234567');
    expect(result).toBe('+94771234567');
  });

  it('should normalize 9-digit number without leading 0', () => {
    const result = normalizePhoneNumber('771234567');
    expect(result).toBe('+94771234567');
  });

  it('should keep already normalized +94 number', () => {
    const result = normalizePhoneNumber('+94771234567');
    expect(result).toBe('+94771234567');
  });

  it('should normalize 11-digit number without + prefix', () => {
    const result = normalizePhoneNumber('94771234567');
    expect(result).toBe('+94771234567');
  });

  it('should remove spaces from phone number', () => {
    const result = normalizePhoneNumber('077 123 4567');
    expect(result).toBe('+94771234567');
  });

  it('should remove hyphens from phone number', () => {
    const result = normalizePhoneNumber('077-123-4567');
    expect(result).toBe('+94771234567');
  });

  it('should remove parentheses from phone number', () => {
    const result = normalizePhoneNumber('(077) 123-4567');
    expect(result).toBe('+94771234567');
  });

  it('should handle mixed formatting characters', () => {
    const result = normalizePhoneNumber('+94 (77) 123-4567');
    expect(result).toBe('+94771234567');
  });

  it('should return null for invalid phone number', () => {
    const result = normalizePhoneNumber('invalid');
    expect(result).toBeNull();
  });

  it('should return null for empty string', () => {
    const result = normalizePhoneNumber('');
    expect(result).toBeNull();
  });

  it('should return null for non-string input', () => {
    const result = normalizePhoneNumber(null as any);
    expect(result).toBeNull();
  });

  it('should return null for too short number', () => {
    const result = normalizePhoneNumber('0771234');
    expect(result).toBeNull();
  });

  it('should return null for too long number', () => {
    const result = normalizePhoneNumber('077123456789');
    expect(result).toBeNull();
  });

  it('should handle all Sri Lankan mobile operator prefixes', () => {
    const prefixes = ['070', '071', '072', '074', '075', '076', '077', '078'];

    prefixes.forEach((prefix) => {
      const result = normalizePhoneNumber(`${prefix}1234567`);
      expect(result).toBe(`+94${prefix.substring(1)}1234567`);
    });
  });
});

describe('Phone Utils - isValidSriLankanPhone', () => {
  it('should accept valid normalized phone number', () => {
    const result = isValidSriLankanPhone('+94771234567');
    expect(result).toBe(true);
  });

  it('should reject phone number without + prefix', () => {
    const result = isValidSriLankanPhone('94771234567');
    expect(result).toBe(false);
  });

  it('should reject phone number with 0 prefix', () => {
    const result = isValidSriLankanPhone('0771234567');
    expect(result).toBe(false);
  });

  it('should reject phone number with wrong country code', () => {
    const result = isValidSriLankanPhone('+1234567890');
    expect(result).toBe(false);
  });

  it('should reject phone number with too few digits', () => {
    const result = isValidSriLankanPhone('+9477123456');
    expect(result).toBe(false);
  });

  it('should reject phone number with too many digits', () => {
    const result = isValidSriLankanPhone('+947712345678');
    expect(result).toBe(false);
  });

  it('should reject phone number with spaces', () => {
    const result = isValidSriLankanPhone('+94 77 123 4567');
    expect(result).toBe(false);
  });

  it('should reject empty string', () => {
    const result = isValidSriLankanPhone('');
    expect(result).toBe(false);
  });

  it('should reject null input', () => {
    const result = isValidSriLankanPhone(null as any);
    expect(result).toBe(false);
  });

  it('should accept all valid operator prefixes', () => {
    const validNumbers = [
      '+94701234567',
      '+94711234567',
      '+94721234567',
      '+94741234567',
      '+94751234567',
      '+94761234567',
      '+94771234567',
      '+94781234567',
    ];

    validNumbers.forEach((number) => {
      expect(isValidSriLankanPhone(number)).toBe(true);
    });
  });
});

describe('Phone Utils - formatPhoneForDisplay', () => {
  it('should format valid phone number for display', () => {
    const result = formatPhoneForDisplay('+94771234567');
    expect(result).toBe('+94 77 123 4567');
  });

  it('should return original string if phone number is invalid', () => {
    const result = formatPhoneForDisplay('invalid');
    expect(result).toBe('invalid');
  });

  it('should return original string if missing + prefix', () => {
    const result = formatPhoneForDisplay('94771234567');
    expect(result).toBe('94771234567');
  });

  it('should format all valid operator prefixes correctly', () => {
    const testCases = [
      { input: '+94701234567', expected: '+94 70 123 4567' },
      { input: '+94711234567', expected: '+94 71 123 4567' },
      { input: '+94721234567', expected: '+94 72 123 4567' },
      { input: '+94741234567', expected: '+94 74 123 4567' },
      { input: '+94751234567', expected: '+94 75 123 4567' },
      { input: '+94761234567', expected: '+94 76 123 4567' },
      { input: '+94771234567', expected: '+94 77 123 4567' },
      { input: '+94781234567', expected: '+94 78 123 4567' },
    ];

    testCases.forEach(({ input, expected }) => {
      expect(formatPhoneForDisplay(input)).toBe(expected);
    });
  });
});

describe('Phone Utils - maskPhoneNumber', () => {
  it('should mask phone number showing first 2 and last 3 digits', () => {
    const result = maskPhoneNumber('+94771234567');
    expect(result).toBe('+94 77 XXX X567');
  });

  it('should return "Invalid phone" for invalid input', () => {
    const result = maskPhoneNumber('invalid');
    expect(result).toBe('Invalid phone');
  });

  it('should return "Invalid phone" for empty string', () => {
    const result = maskPhoneNumber('');
    expect(result).toBe('Invalid phone');
  });

  it('should return "Invalid phone" for null input', () => {
    const result = maskPhoneNumber(null as any);
    expect(result).toBe('Invalid phone');
  });

  it('should mask different operator prefixes correctly', () => {
    const testCases = [
      { input: '+94701234567', expected: '+94 70 XXX X567' },
      { input: '+94711234567', expected: '+94 71 XXX X567' },
      { input: '+94721234567', expected: '+94 72 XXX X567' },
      { input: '+94741234567', expected: '+94 74 XXX X567' },
      { input: '+94751234567', expected: '+94 75 XXX X567' },
      { input: '+94761234567', expected: '+94 76 XXX X567' },
      { input: '+94771234567', expected: '+94 77 XXX X567' },
      { input: '+94781234567', expected: '+94 78 XXX X567' },
    ];

    testCases.forEach(({ input, expected }) => {
      expect(maskPhoneNumber(input)).toBe(expected);
    });
  });

  it('should preserve last 3 digits uniquely', () => {
    const result1 = maskPhoneNumber('+94771234567');
    const result2 = maskPhoneNumber('+94771234999');

    expect(result1).toBe('+94 77 XXX X567');
    expect(result2).toBe('+94 77 XXX X999');
    expect(result1).not.toBe(result2);
  });
});

describe('Phone Utils - Integration Tests', () => {
  it('should normalize then validate phone number', () => {
    const normalized = normalizePhoneNumber('077 123 4567');
    expect(normalized).toBe('+94771234567');

    const isValid = isValidSriLankanPhone(normalized!);
    expect(isValid).toBe(true);
  });

  it('should normalize then format phone number', () => {
    const normalized = normalizePhoneNumber('0771234567');
    expect(normalized).toBe('+94771234567');

    const formatted = formatPhoneForDisplay(normalized!);
    expect(formatted).toBe('+94 77 123 4567');
  });

  it('should normalize then mask phone number', () => {
    const normalized = normalizePhoneNumber('077-123-4567');
    expect(normalized).toBe('+94771234567');

    const masked = maskPhoneNumber(normalized!);
    expect(masked).toBe('+94 77 XXX X567');
  });

  it('should handle full workflow: normalize → validate → format → mask', () => {
    const input = '077 123 4567';

    // Step 1: Normalize
    const normalized = normalizePhoneNumber(input);
    expect(normalized).toBe('+94771234567');

    // Step 2: Validate
    const isValid = isValidSriLankanPhone(normalized!);
    expect(isValid).toBe(true);

    // Step 3: Format
    const formatted = formatPhoneForDisplay(normalized!);
    expect(formatted).toBe('+94 77 123 4567');

    // Step 4: Mask
    const masked = maskPhoneNumber(normalized!);
    expect(masked).toBe('+94 77 XXX X567');
  });
});
