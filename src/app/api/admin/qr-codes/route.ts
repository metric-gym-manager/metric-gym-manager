import { NextResponse } from 'next/server'
import { getSaasAdmin } from '@/lib/auth/requireSaasAdmin'
import { listGymsWithRegistrationLinks } from '@/features/registration/services/registration-link.service'
import { getHttpStatusFromErrorCode, ResponseBuilder } from '@/utils/api'

// ============================================================
// GET /api/admin/qr-codes
// All gyms with their registration QR links (SaaS operator only)
// ============================================================

/**
 * Authorization: Supabase session + `saas_admins` membership (getSaasAdmin) —
 * the canonical SaaS-operator gate, same as /api/admin/system-health/*. No
 * client-held secret.
 */
export async function GET() {
  try {
    // CRITICAL: Strict authorization check BEFORE any database queries.
    const admin = await getSaasAdmin()
    if (!admin) {
      console.warn('Unauthorized admin API access attempt')
      const body = ResponseBuilder.forbidden()
      return NextResponse.json(body, {
        status: getHttpStatusFromErrorCode(body.error.code),
      })
    }

    const items = await listGymsWithRegistrationLinks()

    return NextResponse.json(ResponseBuilder.success(items))
  } catch (error) {
    console.error('Admin QR codes API error:', error)
    const body = ResponseBuilder.internalError('Failed to fetch QR codes')
    return NextResponse.json(body, {
      status: getHttpStatusFromErrorCode(body.error.code),
    })
  }
}
