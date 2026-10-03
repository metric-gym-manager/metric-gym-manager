/**
 * SMS Provider Interface (Port)
 *
 * Defines the contract for SMS sending services.
 * This abstracts the SMS provider (Text.lk, Twilio, etc.) from the business logic.
 *
 * CRITICAL: This interface must NOT contain provider-specific details.
 */

/**
 * SMS message to send
 */
export interface SMSMessage {
  /**
   * Recipient phone number (E.164 format with + prefix)
   * Example: +94771234567
   */
  to: string

  /**
   * Message body (max 160 characters for single SMS)
   */
  message: string
}

/**
 * Result of SMS sending operation
 */
export interface SMSSendResult {
  /**
   * Whether SMS was sent successfully
   */
  success: boolean

  /**
   * Provider's message ID (for tracking)
   * Only present if success is true
   */
  messageId?: string

  /**
   * Error message if sending failed
   * Only present if success is false
   */
  error?: string

  /**
   * Timestamp when SMS was sent
   */
  sentAt?: Date
}

/**
 * SMS Provider Interface
 *
 * This defines operations for sending SMS messages.
 * Infrastructure layer will implement this interface using Text.lk, Twilio, etc.
 *
 * @example
 * // Use in a use case
 * class SendPaymentReminder {
 *   constructor(private smsProvider: ISMSProvider) {}
 *
 *   async execute(member: Member) {
 *     await this.smsProvider.send({
 *       to: member.phoneNumber,
 *       message: `Payment due on ${member.nextDueDate}`
 *     });
 *   }
 * }
 *
 * @example
 * // Send batch SMS
 * await smsProvider.sendBatch([
 *   { to: '+94771234567', message: 'Hello 1' },
 *   { to: '+94771234568', message: 'Hello 2' }
 * ]);
 */
export interface ISMSProvider {
  /**
   * Send a single SMS message
   *
   * @param message - SMS message to send
   * @returns Result of send operation
   */
  send(message: SMSMessage): Promise<SMSSendResult>

  /**
   * Send multiple SMS messages in batch
   *
   * This may be more efficient than sending individually,
   * depending on the provider's API.
   *
   * @param messages - Array of SMS messages to send
   * @returns Array of send results (same order as input)
   */
  sendBatch(messages: SMSMessage[]): Promise<SMSSendResult[]>

  /**
   * Check if SMS sending is enabled
   *
   * This is useful for development/staging environments
   * where we might want to disable actual SMS sending.
   *
   * @returns True if SMS sending is enabled
   */
  isEnabled(): boolean

  /**
   * Get provider name
   *
   * Useful for logging and debugging.
   *
   * @returns Provider name (e.g., 'Text.lk', 'Twilio', 'Mock')
   */
  getProviderName(): string
}
