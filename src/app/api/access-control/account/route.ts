/**
 * GET|PUT /api/access-control/account
 *
 * The gym's vendor account. Credentials are **write-only**: `PUT` stores them
 * encrypted, `GET` never returns them — not even to the owner who typed them.
 * What comes back is the non-secret half plus whether a sign-in probe has ever
 * succeeded.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  accessControlAccountSchema,
  createAccessControlRepository,
  serializeAccessAccountForAPI,
} from '@/features/access-control'
import { requireAccessControlGym } from '@/lib/auth/requireAccessControlGym'
import { createAdminClient } from '@/lib/supabase/admin'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { toErrorResponse } from '@/lib/middleware/apiErrors'

export async function GET() {
  const { caller, error } = await requireAccessControlGym()
  if (error) return error

  try {
    const account = await createAccessControlRepository(
      caller!.supabase
    ).findAccountByGymId(caller!.gymId)

    return NextResponse.json(
      ResponseBuilder.success(
        account ? serializeAccessAccountForAPI(account) : null
      )
    )
  } catch (err) {
    return toErrorResponse(err, 'Failed to load the access control account')
  }
}

export async function PUT(request: NextRequest) {
  const { caller, error } = await requireAccessControlGym()
  if (error) return error

  try {
    const parsed = accessControlAccountSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json(
        ResponseBuilder.validationError(parsed.error.flatten().fieldErrors),
        { status: 400 }
      )
    }

    // Service-role: the secrets table has RLS enabled with no policies, so
    // even the owning gym's session cannot write it. Scoped by the gym id the
    // guard established, never by anything in the body.
    const account = await createAccessControlRepository(
      createAdminClient()
    ).saveCredentials(caller!.gymId, parsed.data)

    return NextResponse.json(
      ResponseBuilder.success(serializeAccessAccountForAPI(account))
    )
  } catch (err) {
    return toErrorResponse(err, 'Failed to save the access control account')
  }
}
