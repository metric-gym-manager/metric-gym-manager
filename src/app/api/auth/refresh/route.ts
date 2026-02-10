import { NextRequest, NextResponse } from 'next/server'
import { refreshSession } from '@/features/auth/services/auth.service'
import { handleError } from '@/lib/middleware/error-handler'

export async function POST(request: NextRequest) {
  try {
    const session = await refreshSession()

    return NextResponse.json({
      success: true,
      data: {
        session
      },
    })
  } catch (error) {
    return handleError(error)
  }
}
