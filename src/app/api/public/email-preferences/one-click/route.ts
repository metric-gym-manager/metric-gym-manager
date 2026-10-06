import { NextRequest, NextResponse } from 'next/server'
import {
  createUpdateEmailPreferences,
  InvalidUnsubscribeLinkError,
  MailingUnavailableError,
  oneClickUnsubscribeSchema,
} from '@/features/mailing'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { checkRateLimit } from '@/lib/rate-limit'

// ============================================================
// /api/public/email-preferences/one-click — List-Unsubscribe (no auth)
// ============================================================

const IP_LIMIT = 10
const IP_WINDOW_MS = 60_000

function params(request: NextRequest) {
  const query = request.nextUrl.searchParams
  return {
    email: query.get('email') ?? '',
    token: query.get('token') ?? '',
    topic: query.get('topic') ?? '',
  }
}

/**
 * A mail app's own "Unsubscribe" button (RFC 8058): Gmail, Yahoo and Outlook
 * POST `List-Unsubscribe=One-Click` here, with no page and no person in
 * between. The URL's signed token is the credential, checked in the
 * use-case, so the opt-out is exactly that address and that topic. Thin (R6):
 * rate-limit → validate → one factory call.
 */
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkRateLimit(`email-preferences:ip:${ip}`, IP_LIMIT, IP_WINDOW_MS)) {
    return NextResponse.json(
      ResponseBuilder.error('Too many requests.', 'RATE_LIMITED'),
      { status: 429 }
    )
  }

  const parsed = oneClickUnsubscribeSchema.safeParse(params(request))
  if (!parsed.success) {
    return NextResponse.json(
      ResponseBuilder.error('This link is not valid.', 'INVALID_LINK'),
      { status: 400 }
    )
  }

  try {
    const { email, token, topic } = parsed.data
    await createUpdateEmailPreferences().execute({
      email,
      token,
      topics: [topic],
    })
    return NextResponse.json(ResponseBuilder.success({ topics: [topic] }), {
      status: 200,
    })
  } catch (error) {
    if (error instanceof InvalidUnsubscribeLinkError) {
      return NextResponse.json(
        ResponseBuilder.error('This link is not valid.', 'INVALID_LINK'),
        { status: 400 }
      )
    }
    if (error instanceof MailingUnavailableError) {
      return NextResponse.json(
        ResponseBuilder.error('Please try again later.', 'MAILING_UNAVAILABLE'),
        { status: 503 }
      )
    }
    console.error('One-click unsubscribe error:', error)
    return NextResponse.json(
      ResponseBuilder.error('Could not unsubscribe.', 'PREFERENCES_ERROR'),
      { status: 500 }
    )
  }
}

/**
 * A person who opens the header's link in a browser gets the unsubscribe
 * page, where they choose; a GET changes nothing (scanners follow links).
 */
export async function GET(request: NextRequest) {
  const target = new URL('/unsubscribe', request.url)
  for (const [key, value] of Object.entries(params(request))) {
    if (value) target.searchParams.set(key, value)
  }
  return NextResponse.redirect(target, 303)
}
