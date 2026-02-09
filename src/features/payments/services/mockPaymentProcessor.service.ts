/**
 * ⚠️ ⚠️ ⚠️ MOCK PAYMENT PROCESSOR - FOR DEVELOPMENT ONLY ⚠️ ⚠️ ⚠️
 *
 * This simulates payment processing for development and testing purposes.
 * Replace with real Stripe integration in production.
 *
 * DO NOT USE IN PRODUCTION!
 */

import crypto from 'crypto'

export interface MockPaymentResult {
  success: boolean
  transactionId: string
  processorData: {
    mockProcessor: string
    timestamp: string
    amount: number
    currency: string
    status: string
    failureReason?: string
  }
}

/**
 * Simulate payment processing with random success/failure
 * @param amount - Payment amount
 * @param paymentMethodId - Payment method identifier (optional)
 * @param metadata - Additional payment metadata
 * @param forceOutcome - Force a specific outcome for testing
 * @returns Mock payment result
 */
export async function processMockPayment(
  amount: number,
  paymentMethodId?: string,
  metadata?: Record<string, any>,
  forceOutcome?: 'success' | 'failure'
): Promise<MockPaymentResult> {
  // Check if mock payments are enabled
  if (process.env.ENABLE_MOCK_PAYMENTS !== 'true') {
    throw new Error('Mock payments are disabled. Set ENABLE_MOCK_PAYMENTS=true in .env')
  }

  // Simulate processing delay (2 seconds)
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Generate a mock transaction ID
  const transactionId = `mock_txn_${crypto.randomBytes(16).toString('hex')}`

  // Determine success or failure
  let success: boolean

  if (forceOutcome) {
    success = forceOutcome === 'success'
  } else {
    // 80% success rate, 20% random failure
    success = Math.random() < 0.8
  }

  const processorData: MockPaymentResult['processorData'] = {
    mockProcessor: 'Mock Payment Gateway v1.0',
    timestamp: new Date().toISOString(),
    amount,
    currency: 'USD',
    status: success ? 'succeeded' : 'failed',
    ...(paymentMethodId && { paymentMethodId }),
    ...(metadata && { metadata }),
    ...(!success && { failureReason: getRandomFailureReason() }),
  }

  return {
    success,
    transactionId,
    processorData,
  }
}

/**
 * Simulate a specific outcome for testing
 */
export async function simulateSpecificOutcome(
  outcome: 'success' | 'failure',
  amount: number
): Promise<MockPaymentResult> {
  return processMockPayment(amount, undefined, undefined, outcome)
}

/**
 * Get a random failure reason for simulation
 */
function getRandomFailureReason(): string {
  const reasons = [
    'insufficient_funds',
    'card_declined',
    'expired_card',
    'incorrect_cvc',
    'processing_error',
    'do_not_honor',
  ]

  return reasons[Math.floor(Math.random() * reasons.length)]
}
