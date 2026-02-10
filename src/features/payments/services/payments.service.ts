import { createClient } from '@/lib/supabase/server'
import { processMockPayment } from './mockPaymentProcessor.service'
import { CreatePaymentInput } from '../schemas/payments.schemas'
import { Payment } from '../types'

// Type definitions for Supabase queries
type PaymentRow = {
  id: string
  gym_id: string
  member_id: string
  membership_id: string | null
  payment_method_id: string | null
  amount: string
  currency: string
  status: string
  type: string
  description: string | null
  mock_processor_id: string | null
  mock_data: any
  processed_at: string | null
  created_at: string
  updated_at: string
}

// Custom error classes
export class NotFoundError extends Error {
  statusCode = 404
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class BadRequestError extends Error {
  statusCode = 400
  constructor(message: string) {
    super(message)
    this.name = 'BadRequestError'
  }
}

/**
 * Create a payment record using Supabase
 */
export async function createPaymentRecord(
  gymId: string,
  memberId: string,
  membershipId: string | null,
  paymentMethodId: string | null,
  amount: number,
  type: 'membership' | 'setup_fee' | 'class_pack' | 'drop_in' | 'other',
  description?: string
): Promise<Payment> {
  const supabase = await createClient()

  const { data: payment, error } = await supabase
    .from('payments')
    .insert({
      gym_id: gymId,
      member_id: memberId,
      membership_id: membershipId,
      payment_method_id: paymentMethodId,
      amount,
      currency: 'USD',
      status: 'pending',
      type,
      description: description || null,
    })
    .select()
    .single<PaymentRow>()

  if (error) throw error

  return {
    id: payment.id,
    gymId: payment.gym_id,
    memberId: payment.member_id,
    membershipId: payment.membership_id || undefined,
    paymentMethodId: payment.payment_method_id || undefined,
    amount: parseFloat(payment.amount),
    currency: payment.currency,
    status: payment.status as Payment['status'],
    type: payment.type as Payment['type'],
    description: payment.description || undefined,
    mockProcessorId: payment.mock_processor_id || undefined,
    mockData: payment.mock_data || {},
    processedAt: payment.processed_at ? new Date(payment.processed_at) : undefined,
    createdAt: new Date(payment.created_at),
    updatedAt: new Date(payment.updated_at),
  }
}

/**
 * Process payment using Supabase (sequential operations with existing trigger)
 */
export async function processPayment(paymentId: string): Promise<Payment> {
  const supabase = await createClient()

  // 1. Get payment record
  const { data: payment, error: fetchError } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single<PaymentRow>()

  if (fetchError || !payment) throw new NotFoundError('Payment not found')

  if (payment.status !== 'pending') {
    throw new BadRequestError(`Payment cannot be processed in ${payment.status} status`)
  }

  // 2. Update status to processing
  await supabase
    .from('payments')
    .update({ status: 'processing' })
    .eq('id', paymentId)

  try {
    // 3. Process with mock processor (keep existing logic)
    const mockResult = await processMockPayment(
      payment.amount,
      payment.payment_method_id || undefined,
      {
        paymentId,
        memberId: payment.member_id,
        membershipId: payment.membership_id,
      }
    )

    // 4. Update payment status
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments')
      .update({
        status: mockResult.success ? 'succeeded' : 'failed',
        mock_processor_id: mockResult.transactionId,
        mock_data: mockResult.processorData,
        processed_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
      .select()
      .single<PaymentRow>()

    if (updateError) throw updateError

    // 5. Database trigger will automatically:
    //    - Update member status to 'active' if payment succeeded
    //    - Update membership status to 'active' if payment succeeded
    //    (See migration: 20240209000003_triggers_and_functions.sql)

    return {
      id: updatedPayment.id,
      gymId: updatedPayment.gym_id,
      memberId: updatedPayment.member_id,
      membershipId: updatedPayment.membership_id || undefined,
      paymentMethodId: updatedPayment.payment_method_id || undefined,
      amount: parseFloat(updatedPayment.amount),
      currency: updatedPayment.currency,
      status: updatedPayment.status as Payment['status'],
      type: updatedPayment.type as Payment['type'],
      description: updatedPayment.description || undefined,
      mockProcessorId: updatedPayment.mock_processor_id || undefined,
      mockData: updatedPayment.mock_data || {},
      processedAt: updatedPayment.processed_at ? new Date(updatedPayment.processed_at) : undefined,
      createdAt: new Date(updatedPayment.created_at),
      updatedAt: new Date(updatedPayment.updated_at),
    }
  } catch (error) {
    // Mark payment as failed if processing throws an error
    await supabase
      .from('payments')
      .update({
        status: 'failed',
        mock_data: { error: (error as Error).message },
      })
      .eq('id', paymentId)

    throw error
  }
}

/**
 * Get payment history using Supabase (supports filtering by gym or member)
 */
export async function getPaymentHistory(
  gymId: string,
  filters?: {
    memberId?: string
    status?: string
    type?: string
    limit?: number
    offset?: number
  }
): Promise<{ payments: Payment[]; total: number }> {
  const supabase = await createClient()

  let query = supabase
    .from('payments')
    .select('*', { count: 'exact' })
    .eq('gym_id', gymId)

  if (filters?.memberId) {
    query = query.eq('member_id', filters.memberId)
  }

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.type) {
    query = query.eq('type', filters.type)
  }

  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  if (filters?.offset) {
    const limit = filters.limit || 10
    query = query.range(filters.offset, filters.offset + limit - 1)
  }

  // Order by most recent first
  query = query.order('created_at', { ascending: false })

  const { data, error, count } = await query.returns<PaymentRow[]>()

  if (error) throw error

  const payments = (data || []).map((p) => ({
    id: p.id,
    gymId: p.gym_id,
    memberId: p.member_id,
    membershipId: p.membership_id || undefined,
    paymentMethodId: p.payment_method_id || undefined,
    amount: parseFloat(p.amount),
    currency: p.currency,
    status: p.status as Payment['status'],
    type: p.type as Payment['type'],
    description: p.description || undefined,
    mockProcessorId: p.mock_processor_id || undefined,
    mockData: p.mock_data || {},
    processedAt: p.processed_at ? new Date(p.processed_at) : undefined,
    createdAt: new Date(p.created_at),
    updatedAt: new Date(p.updated_at),
  }))

  return {
    payments,
    total: count || 0,
  }
}

/**
 * Retry a failed payment using Supabase
 */
export async function retryFailedPayment(paymentId: string): Promise<Payment> {
  const supabase = await createClient()

  const { data: payment, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single<PaymentRow>()

  if (error || !payment) throw new NotFoundError('Payment not found')

  if (payment.status !== 'failed') {
    throw new BadRequestError('Can only retry failed payments')
  }

  // Check retry count in mock_data
  const retryCount = (payment.mock_data as any)?.retryCount || 0
  if (retryCount >= 3) {
    throw new BadRequestError('Maximum retry attempts exceeded')
  }

  // Update retry count and reset to pending status
  await supabase
    .from('payments')
    .update({
      mock_data: { ...(payment.mock_data as any), retryCount: retryCount + 1 },
      status: 'pending',
    })
    .eq('id', paymentId)

  // Process payment again
  return processPayment(paymentId)
}
