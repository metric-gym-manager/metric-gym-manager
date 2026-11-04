import { NextRequest, NextResponse } from 'next/server'
import { registrationSchema } from '@/features/auth/schemas/auth.schemas'
import { registerGym } from '@/features/auth/services/auth.service'
import { rejectCrossSiteRequest } from '@/lib/middleware/sameOrigin'

export async function POST(request: NextRequest) {
  // Another site must not be able to create an account in this browser.
  const crossSite = rejectCrossSiteRequest(request)
  if (crossSite) return crossSite

  try {
    const body = await request.json()

    // Validate input
    const validatedData = registrationSchema.parse(body)

    // Register gym
    const result = await registerGym(validatedData)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: result.data,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration API error:', error)

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid input data' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
