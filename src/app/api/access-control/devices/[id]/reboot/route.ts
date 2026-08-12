/**
 * POST /api/access-control/devices/[id]/reboot
 *
 * Restart a reader — the standard first move when a terminal has stopped
 * responding but is still powered.
 *
 * A reboot does not clear anything: templates and validity windows live in the
 * device's own storage, so members carry on being admitted correctly the
 * moment it comes back.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createOperateDevice } from '@/features/access-control'
import { requireAccessControlGym } from '@/lib/auth/requireAccessControlGym'
import { createAdminClient } from '@/lib/supabase/admin'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { toErrorResponse } from '@/lib/middleware/apiErrors'

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { caller, error } = await requireAccessControlGym()
  if (error) return error

  try {
    const { id } = await context.params

    const result = await createOperateDevice(createAdminClient()).reboot({
      gymId: caller!.gymId,
      deviceId: id,
      actorId: caller!.userId,
    })

    if (!result.applicable) {
      return NextResponse.json(
        ResponseBuilder.notFound(result.error ? 'Reader' : 'Access control'),
        { status: 404 }
      )
    }

    if (!result.dispatched) {
      return NextResponse.json(
        ResponseBuilder.error(
          'The reader did not respond. It may need to be power-cycled at the door.',
          'DEVICE_UNREACHABLE'
        ),
        { status: 502 }
      )
    }

    return NextResponse.json(ResponseBuilder.success({ rebooting: true }))
  } catch (err) {
    return toErrorResponse(err, 'Failed to restart the reader')
  }
}
