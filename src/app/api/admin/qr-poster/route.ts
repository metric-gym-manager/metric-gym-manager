import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getGymPosterInput } from '@/features/registration/services/registration-link.service'
import { renderQrPosterPng } from '@/features/registration/services/qr-poster'
import { getApiGymProfile } from '@/lib/middleware/api-auth'
import {
  getHttpStatusFromErrorCode,
  ResponseBuilder,
} from '@/utils/api'

// ============================================================
// GET /api/admin/qr-poster?gymId=<uuid>
// Any gym's "2b" registration poster as a PNG (SaaS operator only).
// Powers per-gym Print / Download / Print-all on the admin QR dashboard.
// ============================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const QuerySchema = z.object({ gymId: z.string().uuid() })

/**
 * Authorization: SaaS operator only. Requires a valid session whose gym-owner
 * email matches ADMIN_ALLOWED_EMAIL (server-only env var). No client-held secret.
 */
export async function GET(request: Request) {
  // CRITICAL: Strict authorization check BEFORE any database queries.
  const { gymProfile, error: authError } = await getApiGymProfile()
  if (authError) {
    return authError
  }

  const allowedEmail = process.env.ADMIN_ALLOWED_EMAIL
  if (!allowedEmail || gymProfile!.email !== allowedEmail) {
    console.warn('Unauthorized admin QR poster access attempt')
    const body = ResponseBuilder.forbidden()
    return NextResponse.json(body, {
      status: getHttpStatusFromErrorCode(body.error.code),
    })
  }

  const parsed = QuerySchema.safeParse({
    gymId: new URL(request.url).searchParams.get('gymId'),
  })
  if (!parsed.success) {
    const body = ResponseBuilder.badRequest('Invalid gymId')
    return NextResponse.json(body, {
      status: getHttpStatusFromErrorCode(body.error.code),
    })
  }

  const input = await getGymPosterInput(parsed.data.gymId)
  if (!input) {
    const body = ResponseBuilder.notFound('Gym')
    return NextResponse.json(body, {
      status: getHttpStatusFromErrorCode(body.error.code),
    })
  }

  const png = await renderQrPosterPng(input)

  return ResponseBuilder.binary(png, 'image/png', {
    cacheControl: 'private, no-store',
  })
}
