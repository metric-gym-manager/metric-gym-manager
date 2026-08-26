/**
 * POST /api/access-control/account/verify
 *
 * Signs in to the vendor with the gym's stored credentials and stamps
 * `last_verified_at` on success. A stored credential proves nothing on its
 * own — this is how the settings page can say "connected" on evidence.
 *
 * Returns `verified: false` rather than an error status when the probe fails:
 * a wrong password is a normal outcome of this endpoint, not a fault.
 */

import { NextResponse } from 'next/server'
import { createVerifyAccessAccount } from '@/features/access-control'
import { requireAccessControlGym } from '@/lib/auth/requireAccessControlGym'
import { createAdminClient } from '@/lib/supabase/admin'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { toErrorResponse } from '@/lib/middleware/apiErrors'

export async function POST() {
  const { caller, error } = await requireAccessControlGym()
  if (error) return error

  try {
    // Service-role, because `access_control_secrets` has RLS enabled with no
    // policies — a session client cannot read a credential even by accident.
    // The tenant boundary is the gym id the guard just established, never
    // anything from the request.
    const result = await createVerifyAccessAccount(createAdminClient()).execute(
      caller!.gymId
    )

    if (!result.applicable) {
      return NextResponse.json(
        ResponseBuilder.badRequest('No access control credentials are saved'),
        { status: 400 }
      )
    }

    return NextResponse.json(
      ResponseBuilder.success({ verified: result.verified })
    )
  } catch (err) {
    return toErrorResponse(err, 'Could not reach the access control service')
  }
}
