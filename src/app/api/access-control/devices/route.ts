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
  createRegisterDevice,
  registerDeviceSchema,
  serializeAccessDeviceForAPI,
} from '@/features/access-control'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAccessControlGym } from '@/lib/auth/requireAccessControlGym'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { readJsonBody, toErrorResponse } from '@/lib/middleware/apiErrors'

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
    const parsed = registerDeviceSchema.safeParse(await readJsonBody(request))

    if (!parsed.success) {
      return NextResponse.json(
        ResponseBuilder.validationError(parsed.error.flatten().fieldErrors),
        { status: 400 }
      )
    }

    // A serial is globally unique: it is how a webhook event finds its gym, so
    // two gyms claiming one reader would make that routing ambiguous. The
    // repository raises a ConflictError, which surfaces as 409.
    //
    // Service-role for the write: access_devices carries a SELECT-only policy,
    // so the owning gym's own session cannot insert into it. The gym id comes
    // from the guard, never from the body — that is the tenant boundary
    // (rule 2.20), and it is ours to enforce rather than RLS's.
    const result = await createRegisterDevice(createAdminClient()).execute(
      caller!.gymId,
      parsed.data
    )

    // The serial is checked against the gym's own VFT account first (F-07).
    if (result.notOnAccount || !result.device) {
      return NextResponse.json(
        ResponseBuilder.badRequest(
          'This serial is not on your VFT account. Check the label on the reader, or ask VFT to add the reader to your account.'
        ),
        { status: 400 }
      )
    }

    return NextResponse.json(
      ResponseBuilder.success(serializeAccessDeviceForAPI(result.device)),
      { status: 201 }
    )
  } catch (err) {
    return toErrorResponse(err, 'Failed to register the reader')
  }
}
