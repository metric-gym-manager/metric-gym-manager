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

import { isSmsDisabledForGym } from '../config/SmsSuppression'

/**
 * How long a text.lk call may take before we stop waiting.
 *
 * Registration awaits the welcome text and bulk import awaits up to 50 at
 * once, so without a limit a hung gateway held the desk's request until the
 * platform killed it. text.lk normally answers in a second or two.
 */
export const TEXT_LK_TIMEOUT_MS = 10_000

/**
 * Logged as the failed send's `error_message` (shown on /system-health only,
 * rule 2.9). The gateway may still have sent the text, hence "unknown".
 */
export const TEXT_LK_TIMEOUT_ERROR =
  'SMS gateway did not answer within 10 s; delivery unknown'

/**
 * An abort signal that fires after {@link TEXT_LK_TIMEOUT_MS}, and the
 * function that cancels it. A plain timer rather than `AbortSignal.timeout`,
 * so the caller can clear it once the call is done.
 */
function startTimeout(): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TEXT_LK_TIMEOUT_MS)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

/**
 * Response from text.lk API for sending SMS
 */
export interface TextLkResponse {
  success: boolean
  message_id?: string
  error?: string
  balance?: number
  cost?: number
  data?: {
    uid?: string
    balance?: number
    cost?: number
    [key: string]: unknown
  } // For text.lk v3 API response data
}

/**
 * Delivery status from text.lk API
 */
export type DeliveryStatus = 'sent' | 'delivered' | 'failed'

/**
 * Parameters for sending SMS via text.lk
 */
export interface SendSmsParams {
  /**
   * The gym the text is for. Required so no caller can bypass the
   * SMS_DISABLED_GYM_IDS check below.
   */
  gymId: string
  to: string // Phone number in +94XXXXXXXXX format
  message: string // SMS message content (max 160 chars for single SMS)
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
  // Every real text passes through here, so this is where the operator's
  // list of never-text gyms holds (the E2E test gyms). Refused before any
  // network call; callers log it as a failed send with this reason.
  if (isSmsDisabledForGym(params.gymId)) {
    return { success: false, error: 'SMS disabled for this gym' }
  }

  // Covers the request AND reading its body: either can hang.
  const timeout = startTimeout()

  try {
    // Validate environment variables
    if (!process.env.TEXT_LK_API_KEY) {
      console.error('TEXT_LK_API_KEY environment variable is not set')
      return {
        success: false,
        error: 'SMS service not configured',
      }
    }

    // Validate phone number format (+94XXXXXXXXX)
    if (!/^\+94\d{9}$/.test(params.to)) {
      return {
        success: false,
        error: 'Invalid phone number format. Expected +94XXXXXXXXX',
      }
    }

    // Validate message length (160 chars for single SMS)
    if (params.message.length > 160) {
      console.warn(
        `SMS message exceeds 160 characters (${params.message.length} chars). Will be sent as multiple SMS.`
      )
    }

    // Remove '+' from phone number (text.lk expects format: 94XXXXXXXXX)
    const cleanPhone = params.to.replace(/^\+/, '')

    // text.lk v3 API endpoint
    const apiUrl = 'https://app.text.lk/api/v3/sms/send'

    // Make API request
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${process.env.TEXT_LK_API_KEY}`,
      },
      body: JSON.stringify({
        recipient: cleanPhone,
        sender_id: process.env.TEXT_LK_SENDER_ID || 'GymSaaS',
        type: 'plain',
        message: params.message,
      }),
      signal: timeout.signal,
    })

    // Handle non-200 responses
    if (!response.ok) {
      const errorText = await response.text()
      console.error('text.lk API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      })

      return {
        success: false,
        error: `HTTP ${response.status}: Failed to send SMS`,
      }
    }

    // Parse successful response
    const data = await response.json()

    // Check if text.lk returned success status
    if (data.status === 'success') {
      console.log('✓ SMS sent successfully via text.lk')
      return {
        success: true,
        message_id: data.data?.uid || data.message_id,
        balance: data.data?.balance || data.balance,
        cost: data.data?.cost || data.cost,
      }
    } else {
      console.error('text.lk API returned error:', data.message)
      return {
        success: false,
        error: data.message || 'SMS sending failed',
      }
    }
  } catch (error) {
    if (timeout.signal.aborted) {
      console.error('text.lk API timeout:', TEXT_LK_TIMEOUT_ERROR)
      return { success: false, error: TEXT_LK_TIMEOUT_ERROR }
    }

    console.error('text.lk API exception:', error)

    // Network or parsing errors
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to connect to SMS service',
    }
  } finally {
    timeout.clear()
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
  const timeout = startTimeout()

  try {
    if (!process.env.TEXT_LK_API_KEY) {
      console.error('TEXT_LK_API_KEY environment variable is not set')
      return null
    }

    const apiUrl = 'https://app.text.lk/api/v3/balance'

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.TEXT_LK_API_KEY}`,
      },
      signal: timeout.signal,
    })

    if (!response.ok) {
      console.error('text.lk balance API error:', response.status)
      return null
    }

    const data = await response.json()
    return data.balance
  } catch (error) {
    console.error(
      'text.lk balance check exception:',
      timeout.signal.aborted ? TEXT_LK_TIMEOUT_ERROR : error
    )
    return null
  } finally {
    timeout.clear()
  }
}
