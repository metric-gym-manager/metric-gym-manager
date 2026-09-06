/** Cookie name that stores the "remember me" preference. */
export const REMEMBER_ME_COOKIE = 'remember_session'

/** Cookie maxAge for persistent ("remember me") sessions: 1 year in seconds. */
export const REMEMBER_ME_MAX_AGE = 60 * 60 * 24 * 365

/**
 * Explicit host domain for Supabase auth cookies. Set this when staging and
 * production run on sibling subdomains (e.g. staging.saas.com / app.saas.com)
 * so each environment scopes its cookies to its own host and they can never
 * overlap and corrupt each other. Leave unset for host-only cookies (default).
 */
export const AUTH_COOKIE_DOMAIN =
  process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN || undefined

/**
 * Short-lived, JS-readable flag cookie set by the middleware when it had to
 * discard a rotten/expired session. The client reads it once, shows a
 * "session expired" message, and clears it.
 */
export const AUTH_FAILED_COOKIE = 'auth_failed'

/** Response header flag set alongside {@link AUTH_FAILED_COOKIE} for logs/CDN. */
export const AUTH_FAILED_HEADER = 'x-auth-failed'

/**
 * Redirect-loop guard: counts consecutive auth redirects within a short
 * window. When the count exceeds the max, the middleware stops redirecting
 * and serves the login page directly, breaking ERR_TOO_MANY_REDIRECTS.
 */
export const AUTH_LOOP_COOKIE = 'auth_loop_guard'
export const AUTH_LOOP_MAX_REDIRECTS = 3
export const AUTH_LOOP_WINDOW_SECONDS = 10

/**
 * Routes that don't require authentication (exact match).
 *
 * The legal set (`/terms`, `/privacy`, `/refund-policy`) and `/contact` are
 * public because they have to be: payment providers and app stores require
 * terms, privacy and refund policies at URLs a reviewer can open without an
 * account, and `/privacy` is where `ACCESS_EVENT_RETENTION_DAYS` is published
 * for data subjects who by definition have no login (architecture §2.21).
 * Until this was fixed all four answered `307 → /login?redirect=…`, so a
 * prospective customer, a reviewer and a gym member exercising a data-privacy
 * right were equally locked out of documents written for them.
 *
 * All four are statically prerendered and read no session, no Supabase client
 * and no tenant data — verified before opening them, since a public route that
 * reads per-request state is how multi-tenant isolation leaks.
 *
 * Exact matches, deliberately: a `/terms/` prefix would make every future
 * `/terms/<anything>` public by accident.
 */
export const PUBLIC_ROUTES = [
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
  '/terms',
  '/privacy',
  '/refund-policy',
  '/contact',
] as const

/**
 * Public route prefixes (dynamic segments). /join/{token} is the QR
 * self-registration form filled by gym members on their own phones —
 * they never have an account.
 */
export const PUBLIC_ROUTE_PREFIXES = ['/join/'] as const

/**
 * Auth routes that authenticated users shouldn't access (prefix match).
 * Note: /register is excluded to allow authenticated users to view it.
 */
export const AUTH_ROUTES = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/auth/forgot-password',
  '/auth/reset-password',
] as const

/** True when the pathname is public and never requires a session. */
export function isPublicRoute(pathname: string): boolean {
  return (
    PUBLIC_ROUTES.some((route) => pathname === route) ||
    PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  )
}

/** True when the pathname is an auth page authenticated users get bounced from. */
export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname.startsWith(route))
}
