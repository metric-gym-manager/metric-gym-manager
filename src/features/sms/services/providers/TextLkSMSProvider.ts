/**
 * Text.lk SMS Provider Implementation
 *
 * Implements ISMSProvider by delegating to the single text.lk HTTP transport
 * (features/sms/services/textlk.service.ts) — the endpoint, payload shape,
 * validation, and error handling live there and are not duplicated here.
 *
 * API Documentation: https://www.text.lk/apidocs
 *
 * Requires environment variables:
 * - TEXT_LK_API_KEY: Your text.lk API key
 * - TEXT_LK_SENDER_ID: Your registered sender ID (default: "GymSaaS")
 */

import {
  ISMSProvider,
  type SMSMessage,
  type SMSSendResult,
} from '../ISMSProvider'
import { sendSmsViaTextLk } from '../textlk.service'

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
  private readonly apiKey: string

  constructor() {
    this.apiKey = process.env.TEXT_LK_API_KEY || ''

    if (!this.apiKey) {
      console.warn(
        '⚠️  TEXT_LK_API_KEY environment variable is not set. SMS sending will fail.'
      )
    }
  }

  /**
   * Send a single SMS message via the shared text.lk transport
   */
  async send(message: SMSMessage): Promise<SMSSendResult> {
    console.log(`📱 [TEXT.LK] Sending SMS to ${message.to}...`)

    const result = await sendSmsViaTextLk({
      gymId: message.gymId,
      to: message.to,
      message: message.message,
    })

    if (result.success) {
      console.log(`✓ SMS sent successfully (ID: ${result.message_id || 'N/A'})`)
      return {
        success: true,
        messageId: result.message_id,
        sentAt: new Date(),
      }
    }

    return {
      success: false,
      error: result.error || 'SMS sending failed',
    }
  }

  /**
   * Send multiple SMS messages in batch
   */
  async sendBatch(messages: SMSMessage[]): Promise<SMSSendResult[]> {
    // Text.lk doesn't have a native batch API, so we send individually
    console.log(
      `📱 [TEXT.LK] Sending batch of ${messages.length} SMS messages...`
    )

    const results = await Promise.all(
      messages.map((message) => this.send(message))
    )

    const successCount = results.filter((r) => r.success).length
    console.log(
      `✓ Batch complete: ${successCount}/${messages.length} sent successfully`
    )

    return results
  }

  /**
   * Check if SMS sending is enabled
   */
  isEnabled(): boolean {
    return !!this.apiKey
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return 'Text.lk'
  }
}
