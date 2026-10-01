/**
 * Google Analytics 4 glue (the gtag.js snippet is loaded in app/layout.tsx).
 *
 * `trackEvent` is a no-op wherever gtag is absent — tests, blocked by the
 * visitor, or before the script has loaded — so callers never need to guard.
 * Never pass personal data (names, emails, phone numbers) as parameters.
 */

type GtagParams = Record<string, string | number | boolean>

declare global {
  interface Window {
    gtag?: (command: 'event', name: string, params?: GtagParams) => void
  }
}

export function trackEvent(name: string, params?: GtagParams): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  try {
    window.gtag('event', name, params)
  } catch {
    // Analytics must never break the page that reports to it.
  }
}
