import { NextRequest, NextResponse } from 'next/server'
import { refreshAccessToken } from '@/features/auth/services/auth.service'
import { RefreshTokenSchema } from '@/features/auth/schemas/auth.schemas'
import { validateBody } from '@/lib/middleware/validation'
import { handleError } from '@/lib/middleware/error-handler'

export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await validateBody(request, RefreshTokenSchema)
    const tokens = await refreshAccessToken(refreshToken)

    return NextResponse.json({
      success: true,
      data: tokens,
    })
  } catch (error) {
    return handleError(error)
  }
}
