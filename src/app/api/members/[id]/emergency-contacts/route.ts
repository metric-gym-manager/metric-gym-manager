import { NextRequest, NextResponse } from 'next/server'
import {
  addEmergencyContact,
  getEmergencyContacts,
} from '@/features/members/services/members.service'
import { EmergencyContactSchema } from '@/features/members/schemas/members.schemas'
import { authenticate, requireRole } from '@/lib/middleware/auth'
import { validateBody } from '@/lib/middleware/validation'
import { handleError } from '@/lib/middleware/error-handler'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticate(request)
    await requireRole(['gym_owner', 'admin', 'front_desk'])(user)

    const input = await validateBody(request, EmergencyContactSchema)
    const contact = await addEmergencyContact(params.id, user.userId, input)

    return NextResponse.json(
      {
        success: true,
        data: contact,
      },
      { status: 201 }
    )
  } catch (error) {
    return handleError(error)
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticate(request)
    const contacts = await getEmergencyContacts(params.id, user.userId)

    return NextResponse.json({
      success: true,
      data: contacts,
    })
  } catch (error) {
    return handleError(error)
  }
}
