import { NextRequest, NextResponse } from 'next/server'
import { retryFailedPayment } from '@/features/payments/services/payments.service'
import { authenticate, requireRole } from '@/lib/middleware/auth'
import { handleError } from '@/lib/middleware/error-handler'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticate(request)
    await requireRole(['gym_owner', 'admin', 'front_desk'])(user)

    const payment = await retryFailedPayment(params.id, user.userId)

    return NextResponse.json({
      success: true,
      data: payment,
      message:
        payment.status === 'succeeded' ? 'Payment retry successful' : 'Payment retry failed',
    })
  } catch (error) {
    return handleError(error)
  }
}
