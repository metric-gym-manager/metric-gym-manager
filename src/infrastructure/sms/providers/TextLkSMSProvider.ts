/**
 * Text.lk SMS Provider Implementation
 *
 * Implements ISMSProvider using Text.lk API (Sri Lankan SMS provider).
 *
 * API Documentation: https://www.text.lk/apidocs
 *
 * Requires environment variables:
 * - TEXT_LK_API_KEY: Your text.lk API key
 * - TEXT_LK_SENDER_ID: Your registered sender ID (default: "GymSaaS")
 */

import { ISMSProvider, type SMSMessage, type SMSSendResult } from '@/core/ports/services/ISMSProvider';

/**
 * Text.lk API response interface
 */
interface TextLkApiResponse {
  status: string;
  message?: string;
  data?: {
    uid?: string;
    balance?: number;
    cost?: number;
  };
}

/**
 * Text.lk SMS Provider
 *
 * @example
 * const smsProvider = new TextLkSMSProvider();
 *
 * const result = await smsProvider.send({
 *   to: '+94771234567',
 *   message: 'Payment received!'
 * });
 */
export class TextLkSMSProvider implements ISMSProvider {
  private readonly apiUrl = 'https://app.text.lk/api/v3/sms/send';
  private readonly apiKey: string;
  private readonly senderId: string;

  constructor() {
    this.apiKey = process.env.TEXT_LK_API_KEY || '';
    this.senderId = process.env.TEXT_LK_SENDER_ID || 'GymSaaS';

    if (!this.apiKey) {
      console.warn('⚠️  TEXT_LK_API_KEY environment variable is not set. SMS sending will fail.');
    }
  }

  /**
   * Send a single SMS message
   */
  async send(message: SMSMessage): Promise<SMSSendResult> {
    try {
      // Validate API key
      if (!this.apiKey) {
        return {
          success: false,
          error: 'SMS service not configured (TEXT_LK_API_KEY missing)',
        };
      }

      // Validate phone number format
      if (!this.isValidPhoneNumber(message.to)) {
        return {
          success: false,
          error: 'Invalid phone number format. Expected +94XXXXXXXXX',
        };
      }

      // Warn if message exceeds single SMS length
      if (message.message.length > 160) {
        console.warn(
          `⚠️  SMS message exceeds 160 characters (${message.message.length} chars). Will be sent as multiple SMS.`
        );
      }

      // Remove '+' from phone number (text.lk expects format: 94XXXXXXXXX)
      const cleanPhone = message.to.replace(/^\+/, '');

      console.log(`📱 [TEXT.LK] Sending SMS to ${message.to}...`);

      // Make API request
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          recipient: cleanPhone,
          sender_id: this.senderId,
          type: 'plain',
          message: message.message,
        }),
      });

      // Handle non-200 responses
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`✗ text.lk API error: HTTP ${response.status}`, errorText);

        return {
          success: false,
          error: `HTTP ${response.status}: Failed to send SMS`,
        };
      }

      // Parse response
      const data: TextLkApiResponse = await response.json();

      // Check if text.lk returned success
      if (data.status === 'success') {
        console.log(`✓ SMS sent successfully (ID: ${data.data?.uid || 'N/A'})`);

        return {
          success: true,
          messageId: data.data?.uid,
          sentAt: new Date(),
        };
      } else {
        console.error(`✗ text.lk API returned error: ${data.message}`);

        return {
          success: false,
          error: data.message || 'SMS sending failed',
        };
      }
    } catch (error) {
      console.error('✗ text.lk API exception:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to SMS service',
      };
    }
  }

  /**
   * Send multiple SMS messages in batch
   */
  async sendBatch(messages: SMSMessage[]): Promise<SMSSendResult[]> {
    // Text.lk doesn't have a native batch API, so we send individually
    // This could be optimized with Promise.all for parallel sending
    console.log(`📱 [TEXT.LK] Sending batch of ${messages.length} SMS messages...`);

    const results = await Promise.all(
      messages.map((message) => this.send(message))
    );

    const successCount = results.filter((r) => r.success).length;
    console.log(`✓ Batch complete: ${successCount}/${messages.length} sent successfully`);

    return results;
  }

  /**
   * Check if SMS sending is enabled
   */
  isEnabled(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return 'Text.lk';
  }

  /**
   * Validate phone number format
   *
   * @param phoneNumber - Phone number to validate
   * @returns True if valid format (+94XXXXXXXXX)
   */
  private isValidPhoneNumber(phoneNumber: string): boolean {
    return /^\+94\d{9}$/.test(phoneNumber);
  }
}
