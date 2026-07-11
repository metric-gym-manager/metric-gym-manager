import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@/lib/supabase/server';
import {
  REMEMBER_ME_COOKIE,
  REMEMBER_ME_MAX_AGE,
  AUTH_COOKIE_DOMAIN,
  AUTH_FAILED_COOKIE,
  AUTH_FAILED_HEADER,
  AUTH_LOOP_COOKIE,
  AUTH_LOOP_MAX_REDIRECTS,
  AUTH_LOOP_WINDOW_SECONDS,
  isPublicRoute as isPublicRoutePath,
  isAuthRoute as isAuthRoutePath,
} from '@/lib/auth-config';
import {
  findCorruptSessionCookieNames,
  isSupabaseAuthCookie,
  isSupabaseSessionCookie,
  isRetryableAuthError,
} from '@/lib/client-state/auth-token-guard';

function parseLoopCount(raw: string | undefined): number {
  const count = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

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
    // Scope auth cookies to an explicit host when configured, so staging and
    // production on sibling subdomains can't overwrite each other's session.
    if (AUTH_COOKIE_DOMAIN) {
      opts.domain = AUTH_COOKIE_DOMAIN;
    }
    if (rememberSession) {
      opts.maxAge = REMEMBER_ME_MAX_AGE;
    } else {
      // Session cookie — expires when the browser closes.
      delete opts.maxAge;
    }
    return opts;
  }

  // --- Fail-safe: detect rotten Supabase session cookies before they reach
  // the auth client. A malformed/partially-overwritten cookie would otherwise
  // be rejected by the server on every request while the browser keeps
  // resending it — the exact state that produces redirect loops.
  const requestCookies = request.cookies.getAll();
  const allAuthCookieNames = requestCookies
    .filter((cookie) => isSupabaseAuthCookie(cookie.name))
    .map((cookie) => cookie.name);
  const sessionCookieNames = requestCookies
    .filter((cookie) => isSupabaseSessionCookie(cookie.name))
    .map((cookie) => cookie.name);
  const corruptCookieNames = findCorruptSessionCookieNames(requestCookies);
  // Strip corrupt cookies from the request so downstream code sees a clean
  // signed-out state instead of choking on rot.
  corruptCookieNames.forEach((name) => request.cookies.delete(name));

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
    error: authError,
  } = await supabase.auth.getUser();

  const isAuthenticated = !!user;
  const isPublicRoute = isPublicRoutePath(pathname);
  const isAuthRoute = isAuthRoutePath(pathname);

  // Token rot: session cookies were presented (or were corrupt) but produced
  // no user, and the failure is NOT a transient network error. The cookies
  // are dead — keeping them only makes the browser resend them forever.
  const sessionRotted =
    !isAuthenticated &&
    (corruptCookieNames.length > 0 ||
      (sessionCookieNames.length > 0 && !isRetryableAuthError(authError)));

  // Redirect-loop guard: count consecutive auth redirects within a short
  // window. When the browser is bouncing (rotten cookie the server rejects
  // but the client keeps sending), stop redirecting and serve a page —
  // that's what breaks ERR_TOO_MANY_REDIRECTS.
  const loopCount = parseLoopCount(request.cookies.get(AUTH_LOOP_COOKIE)?.value);
  const loopDetected = loopCount >= AUTH_LOOP_MAX_REDIRECTS;

  // Helper: copy refreshed cookies onto a redirect response so they
  // are not lost when we return a new NextResponse.redirect().
  function copyAuthCookies(target: NextResponse) {
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      target.cookies.set(cookie.name, cookie.value, cookieOptions());
    });
  }

  // Helper: expire every Supabase auth cookie the browser sent (plus any
  // corrupt ones already stripped) so it stops resending dead tokens.
  function expireAuthCookies(target: NextResponse) {
    const names = new Set([...allAuthCookieNames, ...corruptCookieNames]);
    names.forEach((name) => {
      target.cookies.set(name, '', { ...cookieOptions(), maxAge: 0 });
    });
  }

  // Helper: flag the response as an auth failure. The header is for
  // logs/CDN observability; the (JS-readable) cookie lets the client show a
  // single "session expired" message after the clean redirect.
  function markAuthFailed(target: NextResponse) {
    target.headers.set(AUTH_FAILED_HEADER, 'true');
    target.cookies.set(AUTH_FAILED_COOKIE, '1', {
      path: '/',
      maxAge: 60,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  function bumpLoopCookie(target: NextResponse) {
    target.cookies.set(AUTH_LOOP_COOKIE, String(loopCount + 1), {
      path: '/',
      maxAge: AUTH_LOOP_WINDOW_SECONDS,
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });
  }

  function clearLoopCookie(target: NextResponse) {
    if (request.cookies.get(AUTH_LOOP_COOKIE)) {
      target.cookies.set(AUTH_LOOP_COOKIE, '', { path: '/', maxAge: 0 });
    }
  }

  // Redirect authenticated users away from auth pages.
  if (isAuthenticated && isAuthRoute) {
    if (loopDetected) {
      // Bouncing login↔dashboard hasn't converged — serve the requested page
      // instead of another 3xx hop.
      clearLoopCookie(supabaseResponse);
      return supabaseResponse;
    }
    const redirectResponse = NextResponse.redirect(
      new URL('/dashboard', request.url)
    );
    copyAuthCookies(redirectResponse);
    bumpLoopCookie(redirectResponse);
    return redirectResponse;
  }

  // Unauthenticated users on protected routes.
  if (!isAuthenticated && !isPublicRoute) {
    if (loopDetected) {
      // Break the loop: rewrite to the login page so the browser receives a
      // clean 200 at the current URL instead of yet another redirect, wipe
      // the dead cookies, and flag the failure for the client to explain.
      const rewriteResponse = NextResponse.rewrite(
        new URL('/login', request.url),
        { request }
      );
      markAuthFailed(rewriteResponse);
      expireAuthCookies(rewriteResponse);
      clearLoopCookie(rewriteResponse);
      return rewriteResponse;
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    copyAuthCookies(redirectResponse);
    if (sessionRotted) {
      // Expire AFTER copyAuthCookies so the deletion wins: the browser must
      // stop resending the rotten tokens or it will bounce forever.
      markAuthFailed(redirectResponse);
      expireAuthCookies(redirectResponse);
    }
    bumpLoopCookie(redirectResponse);
    return redirectResponse;
  }

  // Pass-through. Reset the loop counter and quietly clean up any rot that
  // didn't require a redirect (e.g. a corrupt cookie on a public page, or a
  // stale group next to a valid session).
  clearLoopCookie(supabaseResponse);
  if (sessionRotted) {
    expireAuthCookies(supabaseResponse);
  } else if (corruptCookieNames.length > 0) {
    corruptCookieNames.forEach((name) => {
      supabaseResponse.cookies.set(name, '', { ...cookieOptions(), maxAge: 0 });
    });
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
