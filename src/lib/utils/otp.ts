/**
 * OTP (One-Time Password) generation and validation utilities
 */

/**
 * Generate a random 6-digit OTP code
 *
 * @returns 6-digit OTP code as string
 */
export function generateOTP(): string {
  // Generate random number between 100000 and 999999
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Calculate OTP expiration timestamp
 *
 * @param minutes - Number of minutes until expiration (default: 10)
 * @returns Date object representing expiration time
 */
export function getOTPExpiration(minutes: number = 10): Date {
  const expiration = new Date();
  expiration.setMinutes(expiration.getMinutes() + minutes);
  return expiration;
}

/**
 * Check if OTP has expired
 *
 * @param expiresAt - Expiration timestamp (Date or ISO string)
 * @returns True if OTP is expired
 */
export function isOTPExpired(expiresAt: Date | string): boolean {
  const expirationDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  return new Date() > expirationDate;
}

/**
 * Calculate remaining time until OTP expiration
 *
 * @param expiresAt - Expiration timestamp (Date or ISO string)
 * @returns Remaining seconds (0 if expired)
 */
export function getOTPRemainingSeconds(expiresAt: Date | string): number {
  const expirationDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const now = new Date();
  const remainingMs = expirationDate.getTime() - now.getTime();

  return Math.max(0, Math.floor(remainingMs / 1000));
}

/**
 * Validate OTP code format
 *
 * @param otp - OTP code to validate
 * @returns True if OTP format is valid (6 digits)
 */
export function isValidOTPFormat(otp: string): boolean {
  return /^\d{6}$/.test(otp);
}

/**
 * Generate secure random OTP using crypto (Node.js)
 * More secure than Math.random() for production use
 *
 * @returns 6-digit OTP code as string
 */
export function generateSecureOTP(): string {
  if (typeof window !== 'undefined') {
    // Browser environment - use crypto.getRandomValues
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const randomNum = array[0] % 900000 + 100000;
    return randomNum.toString();
  } else {
    // Node.js environment - use crypto.randomInt
    const crypto = require('crypto');
    return crypto.randomInt(100000, 1000000).toString();
  }
}

/**
 * Format OTP for display (e.g., "123 456")
 *
 * @param otp - 6-digit OTP code
 * @returns Formatted OTP with space in middle
 */
export function formatOTPDisplay(otp: string): string {
  if (otp.length !== 6) return otp;
  return `${otp.substring(0, 3)} ${otp.substring(3, 6)}`;
}
