/**
 * text.lk SMS Service
 *
 * Provides real SMS integration with text.lk API (Sri Lankan SMS provider).
 * Handles sending SMS messages and tracking delivery status.
 *
 * API Documentation: https://www.text.lk/apidocs
 *
 * @module textlk.service
 */

/**
 * Response from text.lk API for sending SMS
 */
export interface TextLkResponse {
  success: boolean;
  message_id?: string;
  error?: string;
  balance?: number;
  cost?: number;
  data?: { uid?: string; balance?: number; cost?: number; [key: string]: unknown }; // For text.lk v3 API response data
}

/**
 * Delivery status from text.lk API
 */
export type DeliveryStatus = 'sent' | 'delivered' | 'failed';

/**
 * Parameters for sending SMS via text.lk
 */
export interface SendSmsParams {
  to: string; // Phone number in +94XXXXXXXXX format
  message: string; // SMS message content (max 160 chars for single SMS)
}

/**
 * Sends an SMS message via text.lk API
 *
 * Requires environment variables:
 * - TEXT_LK_API_KEY: Your text.lk API key
 * - TEXT_LK_SENDER_ID: Your registered sender ID (default: "GymSaaS")
 *
 * @param params - Phone number and message content
 * @returns Response with success status, message ID, and account balance
 *
 * @example
 * const result = await sendSmsViaTextLk({
 *   to: '+94771234567',
 *   message: 'Your OTP code is: 123456'
 * });
 *
 * if (result.success) {
 *   console.log('SMS sent, ID:', result.message_id);
 *   console.log('Remaining balance:', result.balance);
 * } else {
 *   console.error('SMS failed:', result.error);
 * }
 */
export async function sendSmsViaTextLk(
  params: SendSmsParams
): Promise<TextLkResponse> {
  try {
    // Validate environment variables
    if (!process.env.TEXT_LK_API_KEY) {
      console.error('TEXT_LK_API_KEY environment variable is not set');
      return {
        success: false,
        error: 'SMS service not configured',
      };
    }

    // Validate phone number format (+94XXXXXXXXX)
    if (!/^\+94\d{9}$/.test(params.to)) {
      return {
        success: false,
        error: 'Invalid phone number format. Expected +94XXXXXXXXX',
      };
    }

    // Validate message length (160 chars for single SMS)
    if (params.message.length > 160) {
      console.warn(
        `SMS message exceeds 160 characters (${params.message.length} chars). Will be sent as multiple SMS.`
      );
    }

    // Remove '+' from phone number (text.lk expects format: 94XXXXXXXXX)
    const cleanPhone = params.to.replace(/^\+/, '');

    // text.lk v3 API endpoint
    const apiUrl = 'https://app.text.lk/api/v3/sms/send';

    // Make API request
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        Authorization: `Bearer ${process.env.TEXT_LK_API_KEY}`,
      },
      body: JSON.stringify({
        recipient: cleanPhone,
        sender_id: process.env.TEXT_LK_SENDER_ID || 'GymSaaS',
        type: 'plain',
        message: params.message,
      }),
    });

    // Handle non-200 responses
    if (!response.ok) {
      const errorText = await response.text();
      console.error('text.lk API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });

      return {
        success: false,
        error: `HTTP ${response.status}: Failed to send SMS`,
      };
    }

    // Parse successful response
    const data = await response.json();

    // Check if text.lk returned success status
    if (data.status === 'success') {
      console.log('✓ SMS sent successfully via text.lk');
      return {
        success: true,
        message_id: data.data?.uid || data.message_id,
        balance: data.data?.balance || data.balance,
        cost: data.data?.cost || data.cost,
      };
    } else {
      console.error('text.lk API returned error:', data.message);
      return {
        success: false,
        error: data.message || 'SMS sending failed',
      };
    }
  } catch (error) {
    console.error('text.lk API exception:', error);

    // Network or parsing errors
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to connect to SMS service',
    };
  }
}

/**
 * Retrieves delivery status for a sent SMS message
 *
 * Polls text.lk API to check if a message was delivered successfully.
 *
 * @param messageId - The message ID returned from sendSmsViaTextLk
 * @returns Delivery status: 'sent', 'delivered', or 'failed'
 *
 * @example
 * const status = await getSmsDeliveryStatus('msg_abc123');
 * if (status === 'delivered') {
 *   console.log('SMS was delivered successfully');
 * }
 */
export async function getSmsDeliveryStatus(
  messageId: string
): Promise<DeliveryStatus> {
  try {
    // Validate environment variables
    if (!process.env.TEXT_LK_API_KEY) {
      console.error('TEXT_LK_API_KEY environment variable is not set');
      return 'failed';
    }

    // text.lk v3 API endpoint for viewing SMS
    const apiUrl = `https://app.text.lk/api/v3/sms/${messageId}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.TEXT_LK_API_KEY}`,
      },
    });

    if (!response.ok) {
      console.error(
        'text.lk status API error:',
        response.status,
        await response.text().catch(() => '')
      );
      return 'failed';
    }

    const data = await response.json();

    // Map text.lk status to our delivery status
    switch (data.status) {
      case 'DELIVERED':
        return 'delivered';
      case 'SENT':
      case 'PENDING':
        return 'sent';
      case 'FAILED':
      case 'EXPIRED':
      case 'REJECTED':
        return 'failed';
      default:
        console.warn('Unknown text.lk status:', data.status);
        return 'sent'; // Default to 'sent' for unknown statuses
    }
  } catch (error) {
    console.error('text.lk status check exception:', error);
    return 'failed';
  }
}

/**
 * Gets account balance from text.lk API
 *
 * Useful for monitoring SMS credit balance and setting up alerts.
 *
 * @returns Account balance in credits, or null if failed
 *
 * @example
 * const balance = await getTextLkBalance();
 * if (balance !== null && balance < 100) {
 *   console.warn('Low SMS balance:', balance);
 * }
 */
export async function getTextLkBalance(): Promise<number | null> {
  try {
    if (!process.env.TEXT_LK_API_KEY) {
      console.error('TEXT_LK_API_KEY environment variable is not set');
      return null;
    }

    const apiUrl = 'https://app.text.lk/api/v3/balance';

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.TEXT_LK_API_KEY}`,
      },
    });

    if (!response.ok) {
      console.error('text.lk balance API error:', response.status);
      return null;
    }

    const data = await response.json();
    return data.balance;
  } catch (error) {
    console.error('text.lk balance check exception:', error);
    return null;
  }
}
