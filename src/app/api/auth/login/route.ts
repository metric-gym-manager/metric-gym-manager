import { NextRequest, NextResponse } from 'next/server'
import { loginUser } from '@/features/auth/services/auth.service'
import { LoginSchema } from '@/features/auth/schemas/auth.schemas'
import { validateBody } from '@/lib/middleware/validation'
import { handleError } from '@/lib/middleware/error-handler'

export async function POST(request: NextRequest) {
  try {
    const input = await validateBody(request, LoginSchema)
    const result = await loginUser(input)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return handleError(error)
  }
}
