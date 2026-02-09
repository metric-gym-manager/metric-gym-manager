import { NextRequest, NextResponse } from 'next/server'
import { getPaymentHistory } from '@/features/payments/services/payments.service'
import { authenticate } from '@/lib/middleware/auth'
import { handleError } from '@/lib/middleware/error-handler'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request)

    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json(
        {
          success: false,
          error: 'memberId query parameter is required',
        },
        { status: 400 }
      )
    }

    const status = searchParams.get('status') || undefined
    const type = searchParams.get('type') || undefined
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0

    const result = await getPaymentHistory(memberId, user.userId, {
      status,
      type,
      limit,
      offset,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return handleError(error)
  }
}
