import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Next.js Middleware for Supabase authentication
 *
 * This middleware:
 * 1. Automatically refreshes Supabase auth sessions
 * 2. Protects dashboard routes (redirects to /login if unauthenticated)
 * 3. Ensures cookies are properly synced for authentication state
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          // Update request cookies
          request.cookies.set({
            name,
            value,
            ...options,
          })
          // Create new response with updated cookies
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          // Set cookie in response
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          // Remove from request cookies
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          // Create new response with updated cookies
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          // Remove from response cookies
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Refresh session if needed - this is critical for maintaining auth state
  await supabase.auth.getUser()

  // Protect dashboard routes - redirect unauthenticated users to login
  const { data: { user } } = await supabase.auth.getUser()

  if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
    const loginUrl = new URL('/login', request.url)
    // Preserve the original URL to redirect back after login
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

/**
 * Matcher configuration - defines which routes this middleware runs on
 *
 * Currently protects:
 * - /dashboard/* - All dashboard routes
 * - /api/* - All API routes (for session refresh)
 */
export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
}
