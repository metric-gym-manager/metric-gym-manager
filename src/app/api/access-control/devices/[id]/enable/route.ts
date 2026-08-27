/**
 * POST /api/access-control/devices/[id]/enable
 *
 * A state transition, so it gets its own endpoint rather than riding in on a
 * generic update (rule 2.5). Enabling a reader puts it back in the target set
 * for every member sync — a consequential change, and one that should be
 * legible as such in the audit trail.
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
      true
    )

    return NextResponse.json(ResponseBuilder.success({ isActive: true }))
  } catch (err) {
    return toErrorResponse(err, 'Failed to enable the reader')
  }
}
