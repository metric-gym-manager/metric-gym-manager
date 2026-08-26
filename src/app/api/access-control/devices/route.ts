/**
 * GET|POST /api/access-control/devices
 *
 * The gym's readers. Registering does not create hardware — the terminal is
 * already installed and already talking to the vendor; this records which
 * serial belongs to which gym, which is what makes inbound webhook events
 * routable and every device operation tenant-scoped.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  createAccessControlRepository,
  registerDeviceSchema,
  serializeAccessDeviceForAPI,
} from '@/features/access-control'
import { requireAccessControlGym } from '@/lib/auth/requireAccessControlGym'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { toErrorResponse } from '@/lib/middleware/apiErrors'

export async function GET() {
  const { caller, error } = await requireAccessControlGym()
  if (error) return error

  try {
    const devices = await createAccessControlRepository(
      caller!.supabase
    ).listDevices(caller!.gymId)

    return NextResponse.json(
      ResponseBuilder.success(devices.map(serializeAccessDeviceForAPI))
    )
  } catch (err) {
    return toErrorResponse(err, 'Failed to load readers')
  }
}

export async function POST(request: NextRequest) {
  const { caller, error } = await requireAccessControlGym()
  if (error) return error

  try {
    const parsed = registerDeviceSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json(
        ResponseBuilder.validationError(parsed.error.flatten().fieldErrors),
        { status: 400 }
      )
    }

    // A serial is globally unique: it is how a webhook event finds its gym, so
    // two gyms claiming one reader would make that routing ambiguous. The
    // repository raises a ConflictError, which surfaces as 409.
    const device = await createAccessControlRepository(
      caller!.supabase
    ).registerDevice(caller!.gymId, parsed.data)

    return NextResponse.json(
      ResponseBuilder.success(serializeAccessDeviceForAPI(device)),
      { status: 201 }
    )
  } catch (err) {
    return toErrorResponse(err, 'Failed to register the reader')
  }
}
