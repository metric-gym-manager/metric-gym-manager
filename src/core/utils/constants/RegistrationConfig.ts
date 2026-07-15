/**
 * Registration Source Configuration - Single Source of Truth
 *
 * Distinguishes how a member record entered the system.
 */

/**
 * How a member was registered
 */
export enum RegistrationSource {
  /**
   * Registered at the front desk via the standard (manager-filled) form.
   * Manual registrations are considered verified by definition.
   */
  Manual = 'manual',

  /**
   * Self-registered by scanning the gym's QR code (/join/{token}).
   * Shows a NEW badge until the gym verifies the entry (verified_at set).
   */
  Qr = 'qr',
}

/**
 * Check if a registration source value is valid
 *
 * @param source - The value to validate
 * @returns True if valid
 */
export function isValidRegistrationSource(source: string): source is RegistrationSource {
  return Object.values(RegistrationSource).includes(source as RegistrationSource);
}
