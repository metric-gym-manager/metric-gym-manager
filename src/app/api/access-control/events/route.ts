/**
 * GET /api/access-control/events
 *
 * The check-in log, paginated.
 *
 * Successful entries only, deliberately. Refusals do not arrive on the webhook
 * — they land in the device's transaction table, reachable only by polling —
 * and we do not need them: our own database already knows *why* a member was
 * refused, in better language than the device would give us. The member sees
 * the error at the gate; the front desk sees the reason here.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  accessEventsQuerySchema,
  createAccessControlRepository,
  serializeAccessEventForAPI,
} from '@/features/access-control'
import { requireAccessControlGym } from '@/lib/auth/requireAccessControlGym'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { toErrorResponse } from '@/lib/middleware/apiErrors'

export async function GET(request: NextRequest) {
  const { caller, error } = await requireAccessControlGym()
  if (error) return error

  try {
    const parsed = accessEventsQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams)
    )

    if (!parsed.success) {
      return NextResponse.json(
        ResponseBuilder.validationError(parsed.error.flatten().fieldErrors),
        { status: 400 }
      )
    }

    const { events, total } = await createAccessControlRepository(
      caller!.supabase
    ).listEvents(caller!.gymId, parsed.data)

    return NextResponse.json(
      ResponseBuilder.success(events.map(serializeAccessEventForAPI), {
        page: parsed.data.page,
        limit: parsed.data.limit,
        total,
        totalPages: Math.ceil(total / parsed.data.limit),
      })
    )
  } catch (err) {
    return toErrorResponse(err, 'Failed to load the check-in log')
  }
}
