/**
 * GET /api/access-control/members/[id]/enrolment
 *
 * "Has the finger arrived yet?" — polled by the enrolment dialog every few
 * seconds while the member is at the reader.
 *
 * There is no completion callback from the hardware, so this asks the vendor
 * directly. One vendor call per poll, and our stored flag is written only when
 * the answer actually changes.
 *
 * A `false` here is **not an error**. Until the member presents their finger
 * the honest answer is "not yet", and the dialog says so rather than implying
 * something has gone wrong (rule 2.8).
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  createAccessControlRepository,
  createDetectBiometricEnrolment,
} from '@/features/access-control'
import { requireAccessControlGym } from '@/lib/auth/requireAccessControlGym'
import { createAdminClient } from '@/lib/supabase/admin'
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

    const memberContext = await createAccessControlRepository(
      caller!.supabase
    ).getMemberAccessContext(id)

    if (!memberContext || memberContext.gymId !== caller!.gymId) {
      return NextResponse.json(ResponseBuilder.notFound('Member'), {
        status: 404,
      })
    }

    const result = await createDetectBiometricEnrolment(
      createAdminClient()
    ).execute(caller!.gymId, id)

    if (!result.applicable) {
      return NextResponse.json(
        ResponseBuilder.badRequest(
          'Access control is not set up for this gym yet'
        ),
        { status: 400 }
      )
    }

    return NextResponse.json(
      ResponseBuilder.success({ enrolled: result.enrolled })
    )
  } catch (err) {
    // A vendor hiccup mid-poll must not present as a failed enrolment: the
    // member may well be mid-scan. The dialog keeps waiting and retries.
    return toErrorResponse(err, 'Could not check the reader just now')
  }
}
