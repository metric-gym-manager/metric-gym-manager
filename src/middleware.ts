import { NextRequest } from 'next/server'
import { authMiddleware } from './lib/middleware/auth'

/**
 * Next 16 deprecates this file name in favour of `proxy.ts`, and the build
 * warns. It is deliberately not renamed yet. Next runs a `proxy.ts` on the
 * Node.js runtime only (`isProxyFile` -> `onServer()` in
 * next/dist/build/entries.js), while this file builds to the Edge runtime
 * today (`.next/server/edge`). Renaming it would move the auth check on every
 * page request from Edge Middleware to a Node function in sin1. That move has
 * to be seen on a Vercel preview deploy first, and Vercel was refusing every
 * deploy when this was decided (2026-11-04). Rename the file and the export
 * together once a preview can show it.
 */
export async function middleware(request: NextRequest) {
  return authMiddleware(request)
}

export const config = {
  matcher: [
    /*
     * Match only page routes. Exclude:
     * - _next (static files, image optimization)
     * - api (API routes handle their own auth)
     * - static files with extensions (svg, png, ico, etc.)
     */
    '/((?!_next|api|static|.*\\..*|favicon\\.ico).*)',
  ],
}
