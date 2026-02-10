import { NextRequest, NextResponse } from 'next/server'
import { registerUser } from '@/features/auth/services/auth.service'
import { RegisterUserSchema } from '@/features/auth/schemas/auth.schemas'
import { validateBody } from '@/lib/middleware/validation'
import { handleError } from '@/lib/middleware/error-handler'

export async function POST(request: NextRequest) {
  try {
    const input = await validateBody(request, RegisterUserSchema)
    const result = await registerUser(input)

    return NextResponse.json(
      {
        success: true,
        data: {
          user: result.user
        },
      },
      { status: 201 }
    )
  } catch (error) {
    return handleError(error)
  }
}
