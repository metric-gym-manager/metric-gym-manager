/**
 * POST /api/access-control/devices/[id]/disable
 *
 * A state transition with its own endpoint (rule 2.5).
 *
 * Worth being clear about what this does **not** do: disabling a reader stops
 * us sending it new commands, it does not lock the door. The terminal keeps
 * the templates and validity windows it already holds and carries on admitting
 * members from its own clock. That is the same property that makes our
 * downtime survivable, and it means "disable" is a sync setting, not a
 * shutdown.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAccessControlRepository } from '@/features/access-control'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAccessControlGym } from '@/lib/auth/requireAccessControlGym'
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
    const repo = createAccessControlRepository(caller!.supabase)

    const device = await repo.findDeviceById(caller!.gymId, id)
    if (!device) {
      return NextResponse.json(ResponseBuilder.notFound('Reader'), {
        status: 404,
      })
    }

    // Service-role for the write: access_devices carries a SELECT-only policy,
    // so the owning gym's own session cannot update it. Safe because the lookup
    // above already resolved this reader against the caller's gym (rule 2.20).
    await createAccessControlRepository(createAdminClient()).setDeviceActive(
      id,
      false
    )

    return NextResponse.json(ResponseBuilder.success({ isActive: false }))
  } catch (err) {
    return toErrorResponse(err, 'Failed to disable the reader')
  }
}
