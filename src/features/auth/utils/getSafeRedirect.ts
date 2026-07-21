/**
 * Resolve a safe post-login destination from a user-controlled `?redirect=`
 * value.
 *
 * Only internal, absolute paths are allowed. External URLs, protocol-relative
 * `//host` links, and missing/empty values fall back to the dashboard. This
 * prevents an open-redirect: the login page navigates to whatever this returns,
 * so an attacker must not be able to smuggle an off-site URL through the query
 * string.
 *
 * @param target - Raw `redirect` query-param value (or `null` when absent).
 * @returns A safe internal path to navigate to after authentication.
 *
 * @example
 * getSafeRedirect('/members');        // '/members'
 * getSafeRedirect('//evil.com');      // '/dashboard'
 * getSafeRedirect('https://evil.com') // '/dashboard'
 * getSafeRedirect(null);              // '/dashboard'
 */
export function getSafeRedirect(target: string | null): string {
  if (target && target.startsWith('/') && !target.startsWith('//')) {
    return target
  }
  return '/dashboard'
}
