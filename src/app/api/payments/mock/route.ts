import { NextRequest, NextResponse } from 'next/server'
import {
  createPaymentRecord,
  processPayment,
} from '@/features/payments/services/payments.service'
import { ProcessMockPaymentSchema } from '@/features/payments/schemas/payments.schemas'
import { authenticate, requireRole } from '@/lib/middleware/auth'
import { validateBody } from '@/lib/middleware/validation'
import { handleError } from '@/lib/middleware/error-handler'

/**
 * ⚠️ DEV-ONLY ENDPOINT ⚠️
 * Process a mock payment for development and testing
 */
export async function POST(request: NextRequest) {
  try {
    // Check if mock payments are enabled
    if (process.env.ENABLE_MOCK_PAYMENTS !== 'true') {
      return NextResponse.json(
        {
          success: false,
          error: 'Mock payments are disabled',
          message: 'Set ENABLE_MOCK_PAYMENTS=true in .env to enable mock payments',
        },
        { status: 403 }
      )
    }

    const user = await authenticate(request)
    await requireRole(['gym_owner', 'admin', 'front_desk'])(user)

    const input = await validateBody(request, ProcessMockPaymentSchema)

    // Create payment record
    const payment = await createPaymentRecord(user.gymId, user.userId, {
      memberId: input.memberId,
      membershipId: input.membershipId,
      amount: input.amount,
      type: 'membership',
      description: 'Mock payment for development',
      paymentMethodId: input.paymentMethodId,
    })

    // Process payment immediately
    const processedPayment = await processPayment(
      payment.id,
      user.userId,
      input.paymentMethodId,
      input.forceOutcome
    )

    return NextResponse.json(
      {
        success: true,
        data: processedPayment,
        message:
          processedPayment.status === 'succeeded'
            ? 'Payment processed successfully (mock)'
            : 'Payment failed (mock)',
      },
      { status: 201 }
    )
  } catch (error) {
    return handleError(error)
  }
}
