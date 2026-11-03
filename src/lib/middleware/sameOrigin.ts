import { NextResponse } from 'next/server'
import { ResponseBuilder } from '@/utils/api'

/**
 * Refuse a request another website made the visitor's browser send.
 *
 * A browser lets any site POST a `text/plain` form to any origin without a
 * CORS preflight, and `request.json()` parses such a body regardless of its
 * content type. On a sign-in endpoint that is login CSRF: an attacker posts
 * their OWN valid credentials and the visitor's browser ends up signed into the
 * attacker's account. Measured on /api/auth/google, 2026-10-28.
 *
 * Browsers label every request with `Sec-Fetch-Site`; `same-origin` (our pages)
 * and `none` (typed or bookmarked) pass, anything else is refused. Without that
 * header, a cross-origin POST still carries `Origin`, which must name this
 * host. A request with neither comes from a non-browser client, where CSRF does
 * not arise, and passes.
 *
 * @param request - The incoming request.
 * @returns A 403 response to return, or null when the request may proceed.
 */
export function rejectCrossSiteRequest(request: Request): NextResponse | null {
  const site = request.headers.get('sec-fetch-site')
  if (site) {
    return site === 'same-origin' || site === 'none' ? null : forbidden()
  }

  const origin = request.headers.get('origin')
  if (!origin) return null

  try {
    return new URL(origin).host === new URL(request.url).host
      ? null
      : forbidden()
  } catch {
    return forbidden()
  }
}

function forbidden(): NextResponse {
  return NextResponse.json(
    ResponseBuilder.forbidden('This request must come from Metric itself.'),
    { status: 403 }
  )
}
