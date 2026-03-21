import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@/lib/supabase/server';
import { REMEMBER_ME_COOKIE, REMEMBER_ME_MAX_AGE } from '@/lib/auth-config';

// Public routes that don't require authentication
const publicRoutes = [
  '/',
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/auth/verify-email',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/callback',
];

// Auth routes that authenticated users shouldn't access
// Note: /register is excluded to allow authenticated users to view registration page
const authRoutes = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/auth/forgot-password',
  '/auth/reset-password',
];

export async function authMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Read the "remember me" preference set during login.
  const rememberSession =
    request.cookies.get(REMEMBER_ME_COOKIE)?.value === '1';

  // Helper: build cookie options that honour the remember-me preference.
  function cookieOptions(
    base: Record<string, unknown> = {}
  ): Record<string, unknown> {
    const opts: Record<string, unknown> = {
      ...base,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    };
    if (rememberSession) {
      opts.maxAge = REMEMBER_ME_MAX_AGE;
    } else {
      // Session cookie — expires when the browser closes.
      delete opts.maxAge;
    }
    return opts;
  }

  // IMPORTANT: This variable is reassigned inside setAll() when tokens are
  // refreshed. Always return this variable — never create a separate response.
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Create Supabase client for middleware with cookie handling.
  // Following the official Supabase pattern: setAll reassigns supabaseResponse
  // so that refreshed session cookies are preserved on every response path.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options: Record<string, unknown>;
          }>
        ) {
          // Update request cookies so downstream server code sees fresh tokens
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          // Recreate the response to carry the updated cookies
          supabaseResponse = NextResponse.next({
            request,
          });

          // Set each cookie with persistent options that honour "remember me"
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(
              name,
              value,
              cookieOptions(options)
            )
          );
        },
      },
    }
  );

  // CRITICAL: Refresh session to update tokens and extend expiry.
  // This ensures sessions persist across deployments.
  // Do NOT add any logic between creating the client and calling getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthenticated = !!user;
  const isPublicRoute = publicRoutes.some((route) => pathname === route);
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // Helper: copy refreshed cookies onto a redirect response so they
  // are not lost when we return a new NextResponse.redirect().
  function copyAuthCookies(target: NextResponse) {
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      target.cookies.set(cookie.name, cookie.value, cookieOptions());
    });
  }

  // Redirect authenticated users away from auth pages.
  if (isAuthenticated && isAuthRoute) {
    const redirectResponse = NextResponse.redirect(
      new URL('/members', request.url)
    );
    copyAuthCookies(redirectResponse);
    return redirectResponse;
  }

  // Redirect unauthenticated users to login for protected routes.
  if (!isAuthenticated && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    copyAuthCookies(redirectResponse);
    return redirectResponse;
  }

  return supabaseResponse;
}

// Helper to get current user in Server Components
export async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
}

// Helper to get current gym profile (performs full auth check)
export async function getCurrentGymProfile() {
  const user = await requireAuth();

  const supabase = await createClient();
  const { data: gymProfile, error } = await supabase
    .from('gyms')
    .select('id, username, email, email_verified, phone_number, gym_name, gym_address, gym_website, profile_image_url')
    .eq('user_id', user.id)
    .single();

  if (error || !gymProfile) {
    throw new Error('Gym profile not found');
  }

  return gymProfile;
}

// Lighter helper for dashboard layout — skips redundant getUser() since
// middleware already verified authentication. Only checks gym profile exists.
export async function getGymProfileForLayout() {
  const supabase = await createClient();

  // Use getUser() once (middleware already validated, but we need user.id)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data: gymProfile, error } = await supabase
    .from('gyms')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (error || !gymProfile) {
    throw new Error('Gym profile not found');
  }

  return gymProfile;
}
