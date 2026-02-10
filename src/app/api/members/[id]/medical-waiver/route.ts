import { NextRequest, NextResponse } from 'next/server'
import { signMedicalWaiver } from '@/features/members/services/members.service'
import { MedicalWaiverSchema } from '@/features/members/schemas/members.schemas'
import { authenticate, requireRole } from '@/lib/middleware/auth'
import { validateBody } from '@/lib/middleware/validation'
import { handleError } from '@/lib/middleware/error-handler'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticate(request)
    await requireRole(['gym_owner', 'admin', 'front_desk'])(user)

    const input = await validateBody(request, MedicalWaiverSchema)
    await signMedicalWaiver(params.id, input)

    return NextResponse.json(
      {
        success: true,
        message: 'Medical waiver signed successfully',
      },
      { status: 201 }
    )
  } catch (error) {
    return handleError(error)
  }
}
