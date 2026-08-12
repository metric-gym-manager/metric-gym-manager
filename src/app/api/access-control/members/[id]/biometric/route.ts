/**
 * DELETE /api/access-control/members/[id]/biometric
 *
 * Clears a member's fingerprint and **keeps their membership**.
 *
 * This is a route of its own rather than a flag on member update because
 * deleting someone's fingerprint is not an edit to their membership. The
 * registry record and the biometric record are separable in both directions:
 * a member can lose their fingerprint and stay active, and can be removed from
 * a reader for capacity and be restored later without re-enrolling.
 *
 * It never touches the `members` row.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  createAccessControlRepository,
  createManageMemberBiometric,
} from '@/features/access-control'
import { requireAccessControlGym } from '@/lib/auth/requireAccessControlGym'
import { createAdminClient } from '@/lib/supabase/admin'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { toErrorResponse } from '@/lib/middleware/apiErrors'

export async function DELETE(
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

    const result = await createManageMemberBiometric(createAdminClient()).clear(
      caller!.gymId,
      id
    )

    if (!result.applicable) {
      return NextResponse.json(
        ResponseBuilder.badRequest(
          'Access control is not set up for this gym yet'
        ),
        { status: 400 }
      )
    }

    if (!result.dispatched) {
      return NextResponse.json(
        ResponseBuilder.error(
          result.error ?? 'The reader did not accept the request',
          'BIOMETRIC_CLEAR_FAILED'
        ),
        { status: 502 }
      )
    }

    return NextResponse.json(
      ResponseBuilder.success({
        fingerEnrolled: false,
        // Said explicitly so no client renders this as a membership change.
        membershipUnchanged: true,
      })
    )
  } catch (err) {
    return toErrorResponse(err, 'Failed to clear the fingerprint')
  }
}
