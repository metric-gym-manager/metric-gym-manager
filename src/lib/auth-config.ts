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
 *
 * The marketing pages below (the `(marketing)` route group) are public for the
 * same reasons and on the same terms: static, no session, no tenant data. Each
 * one is listed in the page registry (`features/marketing/config/pages.ts`),
 * and `pages.test.ts` fails if a registered page is missing here — a page left
 * out would answer Googlebot with 307 → /login and never be indexed, with
 * every other check green.
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
  // Public marketing pages (SEO). Exact matches, like the legal set.
  '/gym-management-software-sri-lanka',
  '/features/membership-management',
  '/features/payment-collection',
  '/features/sms-reminders',
  '/features/revenue-reporting',
  '/features/access-control',
  '/pricing',
  '/about',
  '/resources',
  '/resources/membership-renewal-reminders',
  '/resources/overdue-gym-memberships',
  '/resources/move-gym-members-from-register-book',
  '/resources/excel-whatsapp-vs-gym-software',
  '/resources/billed-vs-collected-revenue',
  '/resources/choosing-gym-management-software-sri-lanka',
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
 *
 * **`/reset-password` is deliberately NOT here, and must not be re-added.**
 * The recovery link lands there directly, carrying its one-time token, and the
 * page spends the token only when the form is submitted — so a visitor may
 * arrive either anonymous (the normal case) or already signed in, and both must
 * be served. Listing the route here bounced the signed-in case to `/dashboard`.
 *
 * It mattered more under the previous design, where `/auth/callback?type=recovery`
 * called `verifyOtp` first and handed over an authenticated browser: every
 * recovery link then 307'd to `/dashboard`, silently signing the user in while
 * the reset form never rendered.
 *
 * `/verify-email` is the precedent: public, session-bearing, and deliberately
 * absent from this list for the same reason.
 *
 * `/forgot-password` stays: it needs no session, and an authenticated user has
 * no reason to request a recovery mail.
 */
export const AUTH_ROUTES = [
  '/login',
  '/forgot-password',
  '/auth/forgot-password',
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
