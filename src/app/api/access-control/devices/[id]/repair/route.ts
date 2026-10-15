/**
 * POST /api/access-control/devices/[id]/repair
 *
 * "Repair fingerprints": queues a re-seat of every member this reader holds,
 * due a minute from now (visit 2, DEC2-09). The manual stopgap for a power cut
 * (RB-1): after one, only a re-seat brought the fingers back.
 *
 * Talks to no reader itself and is not a state transition: it only queues
 * ordinary member jobs for the outbox to drain.
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

    const result = await createOperateDevice(createAdminClient()).repairReader({
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

    return NextResponse.json(
      ResponseBuilder.success({ membersQueued: result.membersQueued })
    )
  } catch (err) {
    return toErrorResponse(err, 'Failed to queue the repair')
  }
}
