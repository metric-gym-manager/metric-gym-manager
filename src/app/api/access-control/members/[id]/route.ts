/**
 * GET /api/access-control/members/[id]
 *
 * One member's door-access state, as the front desk sees it.
 *
 * Sanitized by construction (rules 2.8 / 2.9): the explanation is plain
 * language derived from our own decision, queued work reads as pending rather
 * than failed, and no vendor return code or database message can reach this
 * response.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createGetMemberAccessStatus } from '@/features/access-control'
import { requireAccessControlGym } from '@/lib/auth/requireAccessControlGym'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { toErrorResponse } from '@/lib/middleware/apiErrors'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { caller, error } = await requireAccessControlGym()
  if (error) return error

  try {
    const { id } = await context.params

    const status = await createGetMemberAccessStatus(caller!.supabase).execute(
      caller!.gymId,
      id
    )

    if (!status) {
      return NextResponse.json(ResponseBuilder.notFound('Member'), {
        status: 404,
      })
    }

    return NextResponse.json(ResponseBuilder.success(status))
  } catch (err) {
    return toErrorResponse(err, 'Failed to load the member’s access state')
  }
}
