/**
 * POST /api/access-control/devices/[id]/unlink
 *
 * Removes the reader from **our** records only.
 *
 * There is deliberately no `DELETE /devices/[id]`, because the vendor exposes
 * no device delete: the terminal stays registered on their platform and keeps
 * every template and validity window it holds. Calling this "delete" would
 * imply the hardware was deprovisioned, which it was not — the UI has to say
 * so plainly, and so does the route name.
 *
 * The practical effect is that we stop syncing to it and stop accepting its
 * events, which frees the serial for another gym to claim.
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
    // so the owning gym's own session cannot unlink it. Safe because the lookup
    // above already resolved this reader against the caller's gym (rule 2.20).
    await createAccessControlRepository(createAdminClient()).unlinkDevice(id)

    return NextResponse.json(
      ResponseBuilder.success({
        unlinked: true,
        // Stated in the payload as well as the docs, so a client cannot render
        // this as "device deleted" without ignoring what it was told.
        hardwareUnchanged: true,
      })
    )
  } catch (err) {
    return toErrorResponse(err, 'Failed to unlink the reader')
  }
}
