/**
 * POST /api/access-control/devices/[id]/free-space
 *
 * Reclaim reader slots on demand — the "Free up space" button behind a
 * nearly-full capacity bar.
 *
 * Only ever removes members who **cannot currently get in**: cancelled first,
 * then expired longest-gone, then suspended. An active member is never a
 * candidate, and if the target cannot be met without touching one the response
 * reports the shortfall rather than taking it. That is a "buy a second reader"
 * conversation, not something to solve by locking out someone who paid.
 *
 * Safe to press repeatedly: the vendor keeps each template centrally, so an
 * evicted member is restored by a plain re-sync and never returns to the
 * scanner.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  createAccessControlRepository,
  createEvictInactiveSubjects,
} from '@/features/access-control'
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

    // Resolved against the caller's own gym before anything reaches the
    // vendor, whose token would happily operate any reader on the account.
    const device = await createAccessControlRepository(
      caller!.supabase
    ).findDeviceById(caller!.gymId, id)

    if (!device) {
      return NextResponse.json(ResponseBuilder.notFound('Reader'), {
        status: 404,
      })
    }

    const result = await createEvictInactiveSubjects(
      createAdminClient()
    ).execute({ gymId: caller!.gymId, reason: 'manual' })

    if (!result.applicable) {
      return NextResponse.json(
        ResponseBuilder.badRequest(
          'Access control is not set up for this gym yet'
        ),
        { status: 400 }
      )
    }

    return NextResponse.json(
      ResponseBuilder.success({
        freed: result.evicted,
        // Non-zero means the reader cannot be freed further without removing
        // someone who can currently enter. The UI must say that plainly rather
        // than presenting it as a failed operation.
        shortfall: result.shortfall,
        atCapacityLimit: result.shortfall > 0,
      })
    )
  } catch (err) {
    return toErrorResponse(err, 'Failed to free up space on the reader')
  }
}
