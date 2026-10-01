/**
 * Site identity — Single Source of Truth for the public website.
 *
 * Everything that names the business, says where it is or how to reach it is
 * read from here: the marketing footer, /contact, /about and the Organization
 * structured data. Before this file existed the footer said "Colombo" with a
 * mailto to one domain while /contact gave a Kotte address and another domain,
 * which is exactly the inconsistency search engines and buyers both notice.
 *
 * Only facts that are published elsewhere in the product belong here: the
 * address, phone and emails are the ones on /contact and in the legal
 * documents; the support hours are the ones the in-app Support page states.
 */

/**
 * Canonical origin. Vercel serves `www.metricgymos.com` as the primary domain;
 * the apex, `metricgymmanager.com` and its `www` all 308-redirect to it. Every
 * canonical, sitemap URL and structured-data `@id` is built on this value — a
 * canonical that points at a redirect is a weaker signal than one that does not.
 */
export const SITE_URL = 'https://www.metricgymos.com'

/** The product name people search for. */
export const SITE_NAME = 'Metric Gym OS'

/** The registered company that operates the product. */
export const LEGAL_NAME = 'Capitalist One (Pvt) Ltd'

export const POSTAL_ADDRESS = {
  streetAddress: '150/1, 3rd Baptist Rd, Beddagana North',
  addressLocality: 'Kotte',
  addressCountry: 'LK',
  /** Display form, one line per entry, as printed on /contact. */
  lines: ['150/1, 3rd Baptist Rd,', 'Beddagana North, Kotte,', 'Sri Lanka'],
} as const

export const CONTACT = {
  phoneE164: '+94704379967',
  phoneDisplay: '+94 70 437 9967',
  whatsappUrl: 'https://wa.me/94704379967',
  supportEmail: 'support@metricgymos.com',
  privacyEmail: 'privacy@metricgymos.com',
} as const

/**
 * Support hours as the in-app Support page states them (Mon–Sun, 08:00–22:00).
 * Sri Lanka observes UTC+05:30 all year, so a single local window is exact.
 */
export const SUPPORT_HOURS = {
  opens: '08:00',
  closes: '22:00',
  display: 'Every day, 08:00–22:00 Sri Lanka time',
  responseNote: 'We usually reply within a few hours.',
} as const

/** Square brand mark used as the Organization logo (≥ 112 px, PNG). */
export const LOGO_PATH = '/icon-512.png'

/**
 * Default social-share card. A static file on purpose: a dynamic
 * `opengraph-image` route has no file extension, so the auth middleware would
 * intercept it and answer social crawlers with a redirect to /login.
 */
export const OG_IMAGE = {
  path: '/og-image.png',
  width: 1200,
  height: 630,
  alt: 'Metric Gym OS — gym management software for Sri Lankan gyms',
} as const

/** Absolute URL for a site path. */
export function absoluteUrl(path: string): string {
  if (path === '/' || path === '') return `${SITE_URL}/`
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
