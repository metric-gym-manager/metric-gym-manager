/**
 * POST /api/access-control/devices/[id]/open
 *
 * Remote unlock. The most physically consequential endpoint in the system:
 * it admits whoever happens to be standing at the door, with no membership
 * check of any kind.
 *
 * So it is audited from two directions — our own job row carrying the acting
 * user, and the reader's own event 8 ("open the door remotely") arriving back
 * through the webhook. Ours proves intent; theirs proves effect.
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

    // Service-role for the credential read; the gym and the actor both come
    // from the session the guard just verified, never from the request.
    const result = await createOperateDevice(createAdminClient()).openDoor({
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
          'The reader did not respond. Try again, or open the door manually.',
          'DEVICE_UNREACHABLE'
        ),
        { status: 502 }
      )
    }

    return NextResponse.json(ResponseBuilder.success({ opened: true }))
  } catch (err) {
    return toErrorResponse(err, 'Failed to open the door')
  }
}
