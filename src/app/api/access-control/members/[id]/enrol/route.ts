/**
 * POST /api/access-control/members/[id]/enrol
 *
 * Puts a reader into enrolment mode for one member; the member then presents
 * their finger at the terminal.
 *
 * We cannot capture a fingerprint from a browser, so enrolment is inherently
 * two-part. The template is created on the hardware and travels to the vendor
 * platform — it never passes through us, which is also why we hold no
 * biometric data of our own.
 *
 * A fingerprint is still sensitive personal data and this endpoint is what
 * causes one to be taken, so it refuses to dispatch without a consent record.
 * The check itself lives in the service rather than here, so no other caller
 * of `enrol` can route around it.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  createAccessControlRepository,
  createManageMemberBiometric,
  enrolBiometricSchema,
} from '@/features/access-control'
import { requireAccessControlGym } from '@/lib/auth/requireAccessControlGym'
import { createAdminClient } from '@/lib/supabase/admin'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { toErrorResponse } from '@/lib/middleware/apiErrors'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { caller, error } = await requireAccessControlGym()
  if (error) return error

  try {
    const { id } = await context.params
    const parsed = enrolBiometricSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json(
        ResponseBuilder.validationError(parsed.error.flatten().fieldErrors),
        { status: 400 }
      )
    }

    const memberContext = await createAccessControlRepository(
      caller!.supabase
    ).getMemberAccessContext(id)

    if (!memberContext || memberContext.gymId !== caller!.gymId) {
      return NextResponse.json(ResponseBuilder.notFound('Member'), {
        status: 404,
      })
    }

    const result = await createManageMemberBiometric(createAdminClient()).enrol(
      {
        gymId: caller!.gymId,
        memberId: id,
        deviceId: parsed.data.deviceId,
        fingerId: parsed.data.fingerId,
        consentGranted: parsed.data.consent,
      }
    )

    if (!result.applicable) {
      return NextResponse.json(
        ResponseBuilder.badRequest(
          'Access control is not set up for this gym yet'
        ),
        { status: 400 }
      )
    }

    // Consent is a precondition the caller can satisfy, not a fault: 400 with
    // its own code so the panel renders a checkbox rather than the 502
    // "reader did not respond" path, which would be a lie about what happened.
    if (result.consentRequired) {
      return NextResponse.json(
        ResponseBuilder.error(
          result.error ??
            'The member must agree to their fingerprint being recorded before it can be registered',
          'BIOMETRIC_CONSENT_REQUIRED'
        ),
        { status: 400 }
      )
    }

    if (!result.dispatched) {
      return NextResponse.json(
        ResponseBuilder.error(
          result.error ?? 'The reader did not accept the enrolment request',
          'ENROLMENT_FAILED'
        ),
        { status: 502 }
      )
    }

    return NextResponse.json(
      ResponseBuilder.success({
        // The reader is waiting for a finger. The template only exists once the
        // member presents it, so this is "ready", never "enrolled".
        awaitingFinger: true,
      })
    )
  } catch (err) {
    return toErrorResponse(err, 'Failed to start enrolment')
  }
}
