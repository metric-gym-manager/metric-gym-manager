/**
 * Mock SMS Provider Implementation
 *
 * Implements ISMSProvider for development and testing.
 * No actual SMS is sent - all operations are logged to console.
 *
 * This provider is useful for:
 * - Local development (avoid SMS costs)
 * - Testing environments
 * - CI/CD pipelines
 */

import { ISMSProvider, type SMSMessage, type SMSSendResult } from '@/features/sms/services/ISMSProvider';

/**
 * Mock SMS Provider
 *
 * @example
 * const smsProvider = new MockSMSProvider();
 *
 * const result = await smsProvider.send({
 *   to: '+94771234567',
 *   message: 'Payment received!'
 * });
 * // SMS not actually sent, just logged to console
 */
export class MockSMSProvider implements ISMSProvider {
  private messageCounter = 0;

  /**
   * Send a single SMS message (mocked)
   */
  async send(message: SMSMessage): Promise<SMSSendResult> {
    this.messageCounter++;
    const mockMessageId = `mock_${Date.now()}_${this.messageCounter}`;

    console.log('📱 [MOCK SMS] Sending SMS (not actually sent):');
    console.log(`   To: ${message.to}`);
    console.log(`   Message: ${message.message}`);
    console.log(`   Mock ID: ${mockMessageId}`);

    // Simulate successful send
    return {
      success: true,
      messageId: mockMessageId,
      sentAt: new Date(),
    };
  }

  /**
   * Send multiple SMS messages in batch (mocked)
   */
  async sendBatch(messages: SMSMessage[]): Promise<SMSSendResult[]> {
    console.log(`📱 [MOCK SMS] Sending batch of ${messages.length} SMS messages (not actually sent):`);

    const results = await Promise.all(
      messages.map((message, index) => {
        console.log(`   ${index + 1}. To ${message.to}: "${message.message.substring(0, 50)}..."`);
        return this.send(message);
      })
    );

    console.log(`✓ Mock batch complete: ${results.length} messages "sent"`);

    return results;
  }

  /**
   * Check if SMS sending is enabled
   */
  isEnabled(): boolean {
    // Mock provider is always "enabled" but doesn't actually send
    return true;
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return 'Mock (Development)';
  }
}
