import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSubmitLead } from '@/features/leads'
import { createLeadSchema } from '@/features/leads'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { checkRateLimit } from '@/lib/rate-limit'

// ============================================================
// POST /api/public/leads — anonymous marketing lead capture (no auth)
// ============================================================

/** Per-IP limit: dampen form bursts from one network. */
const IP_LIMIT = 5
const IP_WINDOW_MS = 60_000

/**
 * Public demo / sales-enquiry endpoint (landing page CTAs).
 *
 * Anonymous by design. Abuse is dampened by a per-IP rate limit and the
 * schema's `website` honeypot (a filled value fails `.parse()`), so the
 * handler stays thin (R6): rate-limit → validate → one factory call. Writes
 * use the service-role admin client because anonymous callers have no RLS
 * session; the `leads` table denies direct client access by default.
 */
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(`lead:ip:${ip}`, IP_LIMIT, IP_WINDOW_MS)) {
      return NextResponse.json(
        ResponseBuilder.error(
          'Too many requests. Please try again shortly.',
          'RATE_LIMITED'
        ),
        { status: 429 }
      )
    }

    const body = await request.json()
    // `website` (honeypot) is validated-then-dropped; only the real fields pass on.
    const { website: _honeypot, ...input } = createLeadSchema.parse(body)

    const lead = await createSubmitLead(createAdminClient()).execute({
      name: input.name,
      email: input.email,
      phone: input.phone,
      gymName: input.gymName || undefined,
      message: input.message || undefined,
      interest: input.interest,
      source: 'landing',
      marketingConsent: input.marketingConsent,
    })

    return NextResponse.json(
      ResponseBuilder.success(
        { id: lead.id },
        { message: "Thanks — we'll be in touch shortly." }
      ),
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string[]> = {}
      for (const issue of error.issues) {
        const field = issue.path.join('.') || 'general'
        fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message]
      }
      return NextResponse.json(ResponseBuilder.validationError(fieldErrors), {
        status: 400,
      })
    }

    console.error('Public leads API error:', error)
    return NextResponse.json(
      ResponseBuilder.error(
        'Could not submit your request. Please try again.',
        'LEAD_ERROR'
      ),
      { status: 500 }
    )
  }
}
