/**
 * SMS Service for sending messages via text.lk
 *
 * In development mode, messages are logged to console instead of sent via SMS.
 * Set ENABLE_REAL_SMS=true in .env to enable actual SMS sending.
 */

interface TextLKResponse {
  status: 'success' | 'error';
  message?: string;
  data?: any;
}

/**
 * Send SMS via text.lk API
 * @param phoneNumber - Recipient phone number (with country code, e.g., +94771234567)
 * @param message - Message content to send
 * @returns Promise<boolean> - True if SMS sent successfully
 */
export async function sendSMS(phoneNumber: string, message: string): Promise<boolean> {
  const enableRealSMS = process.env.ENABLE_REAL_SMS === 'true';

  // In development or if real SMS is disabled, log to console
  if (process.env.NODE_ENV === 'development' || !enableRealSMS) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 SMS (Development Mode)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`To: ${phoneNumber}`);
    console.log(`Message: ${message}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return true;
  }

  try {
    // text.lk API implementation
    const apiKey = process.env.TEXT_LK_API_KEY;
    const senderId = process.env.TEXT_LK_SENDER_ID;

    if (!apiKey || !senderId) {
      console.error('SMS service not configured: Missing TEXT_LK_API_KEY or TEXT_LK_SENDER_ID');
      return false;
    }

    // Remove '+' from phone number if present (text.lk expects format: 94710000000)
    const cleanPhone = phoneNumber.replace(/^\+/, '');

    // Use text.lk v3 API endpoint
    const response = await fetch('https://app.text.lk/api/v3/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        recipient: cleanPhone,
        sender_id: senderId,
        type: 'plain',
        message: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('text.lk API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      return false;
    }

    const data: TextLKResponse = await response.json();

    if (data.status === 'success') {
      console.log('✓ SMS sent successfully via text.lk:', {
        recipient: cleanPhone,
        sender: senderId,
      });
      return true;
    } else {
      console.error('text.lk API returned error:', data.message);
      return false;
    }

  } catch (error) {
    console.error('SMS send error:', error);
    return false;
  }
}

/**
 * Format payment receipt message for SMS
 * @param memberName - Member name
 * @param amount - Payment amount
 * @param nextDueDate - Next payment due date
 * @returns Formatted SMS message
 */
export function formatPaymentReceiptMessage(
  memberName: string,
  amount: number,
  nextDueDate: string
): string {
  return `Dear ${memberName}, your payment of LKR ${amount.toFixed(2)} has been received. Next due date: ${nextDueDate}. Thank you!`;
}

/**
 * Format payment reminder message for SMS
 * @param memberName - Member name
 * @param amount - Amount due
 * @param dueDate - Payment due date
 * @returns Formatted SMS message
 */
export function formatPaymentReminderMessage(
  memberName: string,
  amount: number,
  dueDate: string
): string {
  return `Dear ${memberName}, your payment of LKR ${amount.toFixed(2)} is due on ${dueDate}. Please make the payment to continue your membership.`;
}
