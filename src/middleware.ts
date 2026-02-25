import { NextRequest } from 'next/server';
import { authMiddleware } from './lib/middleware/auth';

export async function middleware(request: NextRequest) {
  return authMiddleware(request);
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
};
