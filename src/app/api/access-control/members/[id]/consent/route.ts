/**
 * POST /api/access-control/members/[id]/consent
 *
 * Records consent for a fingerprint that already exists, e.g. one registered
 * at the reader's own menu (visit 2, V2-6). Rule 2.5: a dedicated operation.
 *
 * Talks to no reader. It writes the consent timestamp only, and never
 * restamps a member who already consented. Enrolment from the app still asks
 * for consent itself (`/enrol`); this is the other half, for a template that
 * arrived some other way.
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

export async function POST(
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

    const result = await createManageMemberBiometric(
      createAdminClient()
    ).recordConsent(caller!.gymId, id)

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
          result.error ?? 'Could not record the consent',
          'BIOMETRIC_CONSENT_FAILED'
        ),
        { status: 502 }
      )
    }

    return NextResponse.json(ResponseBuilder.success({ consentRecorded: true }))
  } catch (err) {
    return toErrorResponse(err, 'Failed to record the consent')
  }
}
