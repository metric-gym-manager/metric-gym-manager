import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  createUpdateEmailPreferences,
  emailPreferencesSchema,
  InvalidUnsubscribeLinkError,
  MailingUnavailableError,
} from '@/features/mailing'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { checkRateLimit } from '@/lib/rate-limit'

// ============================================================
// POST /api/public/email-preferences — the /unsubscribe page (no auth)
// ============================================================

/** Per-IP limit: a person ticks a box once; a script guessing tokens does not. */
const IP_LIMIT = 10
const IP_WINDOW_MS = 60_000

/**
 * Opt a person out of marketing emails, product and security updates, or
 * both. Anonymous by design: the link's token (an HMAC of the email) is the
 * credential, checked in the use-case, so a stranger cannot change anyone
 * else's preferences. Thin (R6): rate-limit → validate → one factory call.
 */
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(`email-preferences:ip:${ip}`, IP_LIMIT, IP_WINDOW_MS)) {
      return NextResponse.json(
        ResponseBuilder.error(
          'Too many requests. Please try again shortly.',
          'RATE_LIMITED'
        ),
        { status: 429 }
      )
    }

    // A truncated or non-JSON body is the client's fault: answer 400, never
    // log it as a server error (a browser closed mid-submit sends one).
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        ResponseBuilder.error('Invalid request.', 'INVALID_REQUEST'),
        { status: 400 }
      )
    }

    const input = emailPreferencesSchema.parse(body)
    await createUpdateEmailPreferences().execute(input)

    return NextResponse.json(
      ResponseBuilder.success({ topics: input.topics }),
      { status: 200 }
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
    if (error instanceof InvalidUnsubscribeLinkError) {
      return NextResponse.json(
        ResponseBuilder.error(
          'This link is not valid. Use the link in your most recent email, or write to hello@metricgymos.com.',
          'INVALID_LINK'
        ),
        { status: 400 }
      )
    }
    if (error instanceof MailingUnavailableError) {
      return NextResponse.json(
        ResponseBuilder.error(
          'We could not update your preferences just now. Please write to hello@metricgymos.com and we will do it for you.',
          'MAILING_UNAVAILABLE'
        ),
        { status: 503 }
      )
    }

    console.error('Email preferences API error:', error)
    return NextResponse.json(
      ResponseBuilder.error(
        'Could not update your preferences. Please try again, or write to hello@metricgymos.com.',
        'PREFERENCES_ERROR'
      ),
      { status: 500 }
    )
  }
}
