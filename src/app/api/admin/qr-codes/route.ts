import { NextResponse } from 'next/server'
import { getSaasAdmin } from '@/lib/auth/requireSaasAdmin'
import { listGymsWithRegistrationLinks } from '@/features/registration/services/registration-link.service'

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
      return NextResponse.json(
        { success: false, error: 'Forbidden - SaaS admin access required' },
        { status: 403 }
      )
    }

    const items = await listGymsWithRegistrationLinks()

    return NextResponse.json({ success: true, data: items })
  } catch (error) {
    if (error instanceof Error && error.message === 'Failed to fetch gyms') {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch gyms' },
        { status: 500 }
      )
    }
    console.error('Admin QR codes API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch QR codes' },
      { status: 500 }
    )
  }
}
