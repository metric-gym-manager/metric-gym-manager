import { namespacedKey, safeGetItem, safeSetItem } from '@/lib/client-state'

/**
 * Carries the address a gym owner just registered with from `/register` to
 * `/verify-email`, which echoes it back and offers to resend the link.
 *
 * It used to travel as `/verify-email?email=…`. GA4 is configured on every
 * route and records the full page URL, query string included, so every
 * sign-up sent its owner's email address to Google Analytics (SEO-056). Never
 * put it back in a URL.
 *
 * sessionStorage, not localStorage: the address is needed for one tab's
 * verify step, survives a reload of that page, and is gone when the tab
 * closes. Storage can be unavailable (private mode, blocked site data); then
 * nothing is remembered and the verify page's resend field starts empty.
 *
 * Client-only. Deep-import this file: the `@/features/auth` barrel is
 * server-only (rule 2.15).
 */
export const PENDING_VERIFICATION_EMAIL_KEY = namespacedKey(
  'pending_verification_email'
)

/** Remember the address for this tab. Returns false when storage refused. */
export function rememberPendingVerificationEmail(email: string): boolean {
  return safeSetItem(PENDING_VERIFICATION_EMAIL_KEY, email, 'session')
}

/** The address registered in this tab, or '' when there is none to offer. */
export function readPendingVerificationEmail(): string {
  return safeGetItem(PENDING_VERIFICATION_EMAIL_KEY, 'session') ?? ''
}
