/**
 * The Google Analytics 4 bootstrap, rendered by the root layout as one inline
 * script. It is the only place GA is loaded or configured.
 *
 * GA4 sends the full page URL as `dl` (page_location) with every hit, query
 * string and path included. Some URLs in this app carry a credential:
 *
 * - `/reset-password?token_hash=…` — a password-recovery token that rule 2.15
 *   deliberately leaves unspent until the form is submitted;
 * - `/verify-email?type=email_change&token_hash=…` — an email-change token;
 * - `/join/{token}` — a gym's self-registration credential.
 *
 * Before SEO-059 each of them reached Google Analytics. On such a URL this
 * script now loads nothing from Google and configures nothing; `gtag` is still
 * defined, so `trackEvent()` stays a harmless no-op.
 *
 * The check runs once, at document load. That is sufficient only because every
 * credential URL is reached by a full page load (an email link, a QR scan, a
 * pasted link) and never by in-app navigation. A credential URL reachable by
 * `<Link>` or `router.push` would be reported by GA's history page views, and
 * this rule would have to move.
 */

export const GA_MEASUREMENT_ID = 'G-D711W4RE25'

/** Query parameters whose presence means the URL must not reach analytics. */
export const SENSITIVE_QUERY_PARAMS = [
  'token_hash',
  'token',
  'code',
  'email',
] as const

/** Path prefixes whose next segment is a credential. */
export const SENSITIVE_PATH_PREFIXES = ['/join/'] as const

const GTAG_SRC = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`

/**
 * The inline bootstrap: GA's standard async snippet behind a credential check.
 * Plain ES5 — it runs before any bundle, in every browser the app supports.
 */
export function gaInitScript(): string {
  return [
    'window.dataLayer = window.dataLayer || [];',
    'function gtag(){dataLayer.push(arguments);}',
    '(function () {',
    `  var params = ${JSON.stringify(SENSITIVE_QUERY_PARAMS)};`,
    `  var prefixes = ${JSON.stringify(SENSITIVE_PATH_PREFIXES)};`,
    '  var search = new URLSearchParams(location.search);',
    '  for (var i = 0; i < params.length; i++) {',
    '    if (search.has(params[i])) return;',
    '  }',
    '  for (var j = 0; j < prefixes.length; j++) {',
    '    if (location.pathname.indexOf(prefixes[j]) === 0) return;',
    '  }',
    "  gtag('js', new Date());",
    `  gtag('config', ${JSON.stringify(GA_MEASUREMENT_ID)});`,
    "  var s = document.createElement('script');",
    '  s.async = true;',
    `  s.src = ${JSON.stringify(GTAG_SRC)};`,
    '  document.head.appendChild(s);',
    '})();',
  ].join('\n')
}
