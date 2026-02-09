import { query, transaction, setUserContext } from '@/lib/db/client'
import { processMockPayment } from './mockPaymentProcessor.service'
import { CreatePaymentInput } from '../schemas/payments.schemas'
import { Payment } from '../types'

/**
 * Create a payment record
 */
export async function createPaymentRecord(
  gymId: string,
  userId: string,
  input: CreatePaymentInput
): Promise<Payment> {
  return transaction(async (client) => {
    // Set RLS context
    await setUserContext(client, userId)

    const result = await client.query<Payment>(
      `INSERT INTO payments (
        gym_id, member_id, membership_id, payment_method_id, amount, type, description, status
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING
         id, gym_id as "gymId", member_id as "memberId",
         membership_id as "membershipId", payment_method_id as "paymentMethodId",
         amount, currency, status, type, description,
         mock_processor_id as "mockProcessorId", mock_data as "mockData",
         processed_at as "processedAt", created_at as "createdAt", updated_at as "updatedAt"`,
      [
        gymId,
        input.memberId,
        input.membershipId || null,
        input.paymentMethodId || null,
        input.amount,
        input.type,
        input.description || null,
      ]
    )

    return result.rows[0]
  })
}

/**
 * Process payment using mock processor
 */
export async function processPayment(
  paymentId: string,
  userId: string,
  paymentMethodId?: string,
  forceOutcome?: 'success' | 'failure'
): Promise<Payment> {
  return transaction(async (client) => {
    // Set RLS context
    await setUserContext(client, userId)

    // Get payment record
    const paymentResult = await client.query(
      'SELECT * FROM payments WHERE id = $1',
      [paymentId]
    )

    if (paymentResult.rowCount === 0) {
      throw new Error('Payment not found')
    }

    const payment = paymentResult.rows[0]

    if (payment.status !== 'pending') {
      throw new Error(`Payment cannot be processed in ${payment.status} status`)
    }

    // Update status to processing
    await client.query('UPDATE payments SET status = $1 WHERE id = $2', ['processing', paymentId])

    try {
      // Call mock payment processor
      const mockResult = await processMockPayment(
        payment.amount,
        paymentMethodId,
        {
          paymentId,
          memberId: payment.member_id,
          membershipId: payment.membership_id,
        },
        forceOutcome
      )

      // Update payment record with result
      const updatedPayment = await client.query<Payment>(
        `UPDATE payments
         SET status = $1, mock_processor_id = $2, mock_data = $3, processed_at = NOW()
         WHERE id = $4
         RETURNING
           id, gym_id as "gymId", member_id as "memberId",
           membership_id as "membershipId", payment_method_id as "paymentMethodId",
           amount, currency, status, type, description,
           mock_processor_id as "mockProcessorId", mock_data as "mockData",
           processed_at as "processedAt", created_at as "createdAt", updated_at as "updatedAt"`,
        [
          mockResult.success ? 'succeeded' : 'failed',
          mockResult.transactionId,
          JSON.stringify(mockResult.processorData),
          paymentId,
        ]
      )

      // Note: Member and membership status updates are handled by database trigger
      // (update_member_status_from_payment function in migrations/helper-functions.js)

      return updatedPayment.rows[0]
    } catch (error) {
      // Mark payment as failed if processing throws an error
      await client.query(
        `UPDATE payments
         SET status = 'failed', mock_data = $1
         WHERE id = $2`,
        [JSON.stringify({ error: (error as Error).message }), paymentId]
      )

      throw error
    }
  })
}

/**
 * Get payment history for a member
 */
export async function getPaymentHistory(
  memberId: string,
  userId: string,
  filters?: {
    status?: string
    type?: string
    limit?: number
    offset?: number
  }
): Promise<{ payments: Payment[]; total: number }> {
  let queryText = `
    SELECT
      id, gym_id as "gymId", member_id as "memberId",
      membership_id as "membershipId", payment_method_id as "paymentMethodId",
      amount, currency, status, type, description,
      mock_processor_id as "mockProcessorId", mock_data as "mockData",
      processed_at as "processedAt", created_at as "createdAt", updated_at as "updatedAt"
    FROM payments
    WHERE member_id = $1
  `

  const params: any[] = [memberId]
  let paramIndex = 2

  if (filters?.status) {
    queryText += ` AND status = $${paramIndex}`
    params.push(filters.status)
    paramIndex++
  }

  if (filters?.type) {
    queryText += ` AND type = $${paramIndex}`
    params.push(filters.type)
    paramIndex++
  }

  // Get total count
  const countResult = await query(`SELECT COUNT(*) as count FROM (${queryText}) as subquery`, params)
  const total = parseInt(countResult.rows[0].count)

  // Add pagination
  queryText += ` ORDER BY created_at DESC`

  if (filters?.limit) {
    queryText += ` LIMIT $${paramIndex}`
    params.push(filters.limit)
    paramIndex++
  }

  if (filters?.offset) {
    queryText += ` OFFSET $${paramIndex}`
    params.push(filters.offset)
  }

  const result = await query<Payment>(queryText, params)

  return {
    payments: result.rows,
    total,
  }
}

/**
 * Retry a failed payment
 */
export async function retryFailedPayment(
  paymentId: string,
  userId: string
): Promise<Payment> {
  return transaction(async (client) => {
    // Set RLS context
    await setUserContext(client, userId)

    // Get payment record
    const paymentResult = await client.query(
      'SELECT * FROM payments WHERE id = $1',
      [paymentId]
    )

    if (paymentResult.rowCount === 0) {
      throw new Error('Payment not found')
    }

    const payment = paymentResult.rows[0]

    if (payment.status !== 'failed') {
      throw new Error('Only failed payments can be retried')
    }

    // Check retry count in mock_data
    const mockData = payment.mock_data || {}
    const retryCount = (mockData.retryCount || 0) + 1

    if (retryCount > 3) {
      throw new Error('Maximum retry attempts (3) exceeded')
    }

    // Update retry count
    await client.query(
      'UPDATE payments SET mock_data = $1, status = $2 WHERE id = $3',
      [JSON.stringify({ ...mockData, retryCount }), 'pending', paymentId]
    )

    // Process payment again
    return processPayment(paymentId, userId)
  })
}
