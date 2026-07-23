import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSaasAdmin } from '@/lib/auth/requireSaasAdmin'
import { rotateRegistrationToken } from '@/features/registration/services/registration-link.service'

// ============================================================
// POST /api/admin/qr-codes/regenerate
// Rotate a single gym's registration token (SaaS operator only).
// Generating a new QR invalidates every previously printed poster for that gym.
// ============================================================

export const dynamic = 'force-dynamic'

const BodySchema = z.object({ gymId: z.string().uuid() })

/**
 * Authorization: Supabase session + `saas_admins` membership (getSaasAdmin).
 * This is a dedicated operational endpoint (rule 2.5) — token rotation is a
 * state transition, not a generic update.
 */
export async function POST(request: Request) {
  try {
    // CRITICAL: Strict authorization check BEFORE any database queries.
    const admin = await getSaasAdmin()
    if (!admin) {
      console.warn('Unauthorized admin QR regenerate attempt')
      return NextResponse.json(
        { success: false, error: 'Forbidden - SaaS admin access required' },
        { status: 403 }
      )
    }

    const parsed = BodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid gymId' },
        { status: 400 }
      )
    }

    const link = await rotateRegistrationToken(parsed.data.gymId)

    return NextResponse.json({ success: true, data: link })
  } catch (error) {
    console.error('Admin QR regenerate API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to regenerate QR code' },
      { status: 500 }
    )
  }
}
