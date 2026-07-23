import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getGymPosterInput } from '@/features/registration/services/registration-link.service'
import { renderQrPosterPng } from '@/features/registration/services/qr-poster'
import { getSaasAdmin } from '@/lib/auth/requireSaasAdmin'
import { getHttpStatusFromErrorCode, ResponseBuilder } from '@/utils/api'

// ============================================================
// GET /api/admin/qr-poster?gymId=<uuid>
// Any gym's "2b" registration poster as a PNG (SaaS operator only).
// Powers per-gym Print / Download / Print-all on the admin QR dashboard.
// ============================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const QuerySchema = z.object({ gymId: z.string().uuid() })

/**
 * Authorization: Supabase session + `saas_admins` membership (getSaasAdmin) —
 * the canonical SaaS-operator gate, same as the QR dashboard listing. No
 * client-held secret.
 */
export async function GET(request: Request) {
  // CRITICAL: Strict authorization check BEFORE any database queries.
  const admin = await getSaasAdmin()
  if (!admin) {
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
