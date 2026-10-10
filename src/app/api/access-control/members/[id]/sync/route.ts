/**
 * POST /api/access-control/members/[id]/sync
 *
 * Force a re-assert of one member's validity window.
 *
 * Routine changes reach the hardware through the outbox on their own — this is
 * the manual override for the case the front desk actually hits: a member is
 * standing at the door insisting they paid, and staff want to push the fix now
 * rather than explain a queue.
 *
 * It re-derives everything from current state rather than replaying a command,
 * so pressing it twice is harmless.
 *
 * And it really is forced: every active reader is sent the member, the grant
 * and the window whatever our record says they hold. It used to diff against
 * that record, which agrees with itself however wrong it is — so the one case
 * this button exists for (a reader that lost the member, or never collected
 * the push) sent nothing and reported "Readers updated". Found on 2026-10-07
 * with Device B four commands behind while our record called it current.
 *
 * Visit 1 (D1): forced is not enough after a reader restart — the reader keeps
 * the user and ignores a re-pushed template — so this re-seats: delete from the
 * readers, then add back from VFT's central copy. A failure queues a forced
 * retry, which is what the desk toast promises.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSyncMemberAccess } from '@/features/access-control'
import { requireAccessControlGym } from '@/lib/auth/requireAccessControlGym'
import { createAdminClient } from '@/lib/supabase/admin'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { toErrorResponse } from '@/lib/middleware/apiErrors'
import { createAccessControlRepository } from '@/features/access-control'

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { caller, error } = await requireAccessControlGym()
  if (error) return error

  try {
    const { id } = await context.params

    // Ownership is established against the caller's own gym before we touch
    // service-role: `SyncMemberAccess` takes a member id alone, so this route
    // is where that member is proved to be this gym's.
    const context_ = await createAccessControlRepository(
      caller!.supabase
    ).getMemberAccessContext(id)

    if (!context_ || context_.gymId !== caller!.gymId) {
      return NextResponse.json(ResponseBuilder.notFound('Member'), {
        status: 404,
      })
    }

    const result = await createSyncMemberAccess(createAdminClient()).execute({
      memberId: id,
      force: true,
      reseat: true,
      retryOnFailure: true,
    })

    if (!result.applicable) {
      return NextResponse.json(
        ResponseBuilder.badRequest(
          'Access control is not set up for this gym yet'
        ),
        { status: 400 }
      )
    }

    // Failures are counted, not quoted: the vendor's words are for the admin
    // health view (rule 2.9). Queued commands are progress, not failure
    // (rule 2.8).
    return NextResponse.json(
      ResponseBuilder.success({
        allowed: result.allowed,
        commandsSent: result.commandsSent,
        commandsPending: result.commandsPending,
        failed: result.failures.length > 0,
      })
    )
  } catch (err) {
    return toErrorResponse(err, 'Failed to sync the member')
  }
}
