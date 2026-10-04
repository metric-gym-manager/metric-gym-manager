/**
 * Public page registry — Single Source of Truth for every indexable page.
 *
 * One entry drives a page's <title>, meta description, canonical, Open Graph
 * tags, breadcrumb trail, navigation label and sitemap entry. `pages.test.ts`
 * holds the registry to four promises a crawler depends on:
 *
 * 1. every path is public — `isPublicRoute()` is true, so the auth middleware
 *    serves it instead of answering 307 → /login (a page missing from
 *    PUBLIC_ROUTES is invisible to Googlebot while every unit test passes);
 * 2. every path has a page module under src/app;
 * 3. titles and descriptions are unique and within display length;
 * 4. every parent exists, so breadcrumbs never dangle.
 *
 * `lastModified` is the date the page's CONTENT last changed, not the build
 * date. Search engines ignore a lastmod that changes on every deploy; bump it
 * when you change what the page says.
 */

export type MarketingPageKind =
  | 'home'
  | 'hub'
  | 'feature'
  | 'pricing'
  | 'company'
  | 'contact'
  | 'resources'
  | 'article'
  | 'legal'

export interface MarketingPage {
  path: string
  kind: MarketingPageKind
  /** Full <title>; never passed through the root template. */
  title: string
  description: string
  /** Short label for navigation and breadcrumbs. */
  label: string
  /** Parent path for the breadcrumb trail; the homepage has none. */
  parent?: string
  /** YYYY-MM-DD — when the page's content last changed. */
  lastModified: string
  /** Articles only — YYYY-MM-DD first publication. */
  published?: string
}

export const HOME_PATH = '/'
export const HUB_PATH = '/gym-management-software-sri-lanka'
export const PRICING_PATH = '/pricing'
export const ABOUT_PATH = '/about'
export const CONTACT_PATH = '/contact'
export const RESOURCES_PATH = '/resources'

export const FEATURE_PATHS = {
  membership: '/features/membership-management',
  payments: '/features/payment-collection',
  sms: '/features/sms-reminders',
  revenue: '/features/revenue-reporting',
  access: '/features/access-control',
} as const

export const ARTICLE_PATHS = {
  reminders: '/resources/membership-renewal-reminders',
  overdue: '/resources/overdue-gym-memberships',
  move: '/resources/move-gym-members-from-register-book',
  compare: '/resources/excel-whatsapp-vs-gym-software',
  revenue: '/resources/billed-vs-collected-revenue',
} as const

const SITE_LAUNCH = '2026-10-01'
const OVERDUE_GUIDE = '2026-10-02'
const MOVE_GUIDE = '2026-10-03'
/** The overdue guide gained the early-payment rule (owner decision). */
const EARLY_PAYMENT_RULE = '2026-10-04'
/** Weekly plans stopped receiving automated reminders (owner decision). */
const WEEKLY_REMINDERS = '2026-10-04'
/** The access-control page stopped naming the hardware partner (owner). */
const PARTNER_UNNAMED = '2026-10-04'
/** /contact links the official Facebook page (SEO-040). */
const SOCIAL_LINKED = '2026-10-04'

export const MARKETING_PAGES: readonly MarketingPage[] = [
  {
    path: HOME_PATH,
    kind: 'home',
    title: 'Gym Management Software for Sri Lankan Gyms | Metric Gym OS',
    description:
      'Metric Gym OS runs memberships, renewals, SMS reminders, revenue reports and fingerprint door access for gyms in Sri Lanka. Plans from LKR 2,990 a month.',
    label: 'Home',
    lastModified: SITE_LAUNCH,
  },
  {
    path: HUB_PATH,
    kind: 'hub',
    title: 'Gym Management System in Sri Lanka: Features, Pricing, Setup',
    description:
      'How Metric Gym OS manages members, renewals, SMS reminders, revenue and door access for Sri Lankan gyms — with LKR pricing, setup steps and data protection.',
    label: 'Gym management software',
    parent: HOME_PATH,
    lastModified: MOVE_GUIDE,
  },
  {
    path: FEATURE_PATHS.membership,
    kind: 'feature',
    title: 'Gym Membership Software for Sri Lanka | Metric Gym OS',
    description:
      'Member records, seven plan types, QR self-registration from a member’s own phone, discounts and admission fees — membership management for Sri Lankan gyms.',
    label: 'Membership management',
    parent: HUB_PATH,
    lastModified: MOVE_GUIDE,
  },
  {
    path: FEATURE_PATHS.payments,
    kind: 'feature',
    title: 'Gym Payment Collection Software in Sri Lanka | Metric Gym OS',
    description:
      'Track who owes what, record desk payments with an SMS receipt, renew memberships on the right date and see overdue members before they lapse.',
    label: 'Payment collection',
    parent: HUB_PATH,
    lastModified: SITE_LAUNCH,
  },
  {
    path: FEATURE_PATHS.sms,
    kind: 'feature',
    title: 'Gym SMS Reminder Software in Sri Lanka | Metric Gym OS',
    description:
      'Automatic renewal reminders timed to each plan, SMS receipts and bulk announcements — with every message logged as sent, delivered or failed.',
    label: 'SMS reminders',
    parent: HUB_PATH,
    lastModified: WEEKLY_REMINDERS,
  },
  {
    path: FEATURE_PATHS.revenue,
    kind: 'feature',
    title: 'Gym Revenue & Membership Analytics | Metric Gym OS',
    description:
      'See what members owe this month against what you collected, revenue by plan, renewal and churn rates, at-risk members and cohort retention.',
    label: 'Revenue & analytics',
    parent: HUB_PATH,
    lastModified: SITE_LAUNCH,
  },
  {
    path: FEATURE_PATHS.access,
    kind: 'feature',
    title: 'Gym Access Control Software in Sri Lanka | Metric Gym OS',
    description:
      'Fingerprint door access that follows each member’s paid-through date. ZKTeco readers from our hardware partner enforce expiry even offline.',
    label: 'Access control',
    parent: HUB_PATH,
    lastModified: PARTNER_UNNAMED,
  },
  {
    path: PRICING_PATH,
    kind: 'pricing',
    title: 'Gym Management Software Pricing (LKR) | Metric Gym OS',
    description:
      'Lite LKR 2,990, Pro LKR 4,990 and Enterprise LKR 6,990 a month, billed monthly through PayHere. Start with a 30-day free trial — no payment details needed.',
    label: 'Pricing',
    parent: HOME_PATH,
    lastModified: SITE_LAUNCH,
  },
  {
    path: ABOUT_PATH,
    kind: 'company',
    title: 'About Metric Gym OS — Capitalist One (Pvt) Ltd, Sri Lanka',
    description:
      'Metric Gym OS is gym management software built and run in Sri Lanka by Capitalist One (Pvt) Ltd. How we build it, how we support gyms, where we are.',
    label: 'About',
    parent: HOME_PATH,
    lastModified: SITE_LAUNCH,
  },
  {
    path: CONTACT_PATH,
    kind: 'contact',
    title: 'Contact Sales & Support | Metric Gym OS',
    description:
      'Call or WhatsApp +94 70 437 9967, email support@metricgymos.com, or write to Capitalist One (Pvt) Ltd in Kotte. Support every day, 08:00–22:00.',
    label: 'Contact',
    parent: HOME_PATH,
    lastModified: SOCIAL_LINKED,
  },
  {
    path: RESOURCES_PATH,
    kind: 'resources',
    title: 'Resources for Gym Owners | Metric Gym OS',
    description:
      'Guides for Sri Lankan gyms: Excel and WhatsApp vs software, moving off a register book, renewal reminders, overdue members and revenue owed vs collected.',
    label: 'Resources',
    parent: HOME_PATH,
    lastModified: MOVE_GUIDE,
  },
  {
    path: ARTICLE_PATHS.reminders,
    kind: 'article',
    title: 'When to Send Gym Membership Renewal Reminders | Metric Gym OS',
    description:
      'A renewal reminder schedule by plan length: why monthly members need fewer messages than annual ones, what each SMS should say, and what follows the due date.',
    label: 'Renewal reminder timing',
    parent: RESOURCES_PATH,
    lastModified: WEEKLY_REMINDERS,
    published: SITE_LAUNCH,
  },
  {
    path: ARTICLE_PATHS.overdue,
    kind: 'article',
    title: 'Overdue Gym Members: When to Expire or Cancel | Metric Gym OS',
    description:
      'When an unpaid gym membership should expire, how long to wait before cancelling it, and what to do when a member pays late — the rules Metric runs on.',
    label: 'Overdue memberships',
    parent: RESOURCES_PATH,
    lastModified: EARLY_PAYMENT_RULE,
    published: OVERDUE_GUIDE,
  },
  {
    path: ARTICLE_PATHS.compare,
    kind: 'article',
    title: 'Excel and WhatsApp vs Gym Management Software | Metric Gym OS',
    description:
      'What a spreadsheet and WhatsApp do well for a gym, where they break, what gym software changes, and why Metric sends SMS rather than WhatsApp.',
    label: 'Spreadsheet vs gym software',
    parent: RESOURCES_PATH,
    lastModified: MOVE_GUIDE,
    published: MOVE_GUIDE,
  },
  {
    path: ARTICLE_PATHS.move,
    kind: 'article',
    title: "How to Move Your Gym's Members into Software | Metric Gym OS",
    description:
      'Moving members off a register book or spreadsheet: what to collect, which date to enter, what members receive by SMS, and letting new members register by QR.',
    label: 'Moving off a register book',
    parent: RESOURCES_PATH,
    lastModified: MOVE_GUIDE,
    published: MOVE_GUIDE,
  },
  {
    path: ARTICLE_PATHS.revenue,
    kind: 'article',
    title: 'Billed vs Collected: Measuring Gym Revenue | Metric Gym OS',
    description:
      'Why dividing annual plans by twelve misleads, how to calculate what members owe this month, and how to read your collection rate.',
    label: 'Billed vs collected revenue',
    parent: RESOURCES_PATH,
    lastModified: SITE_LAUNCH,
    published: SITE_LAUNCH,
  },
  {
    path: '/privacy',
    kind: 'legal',
    title: 'Privacy Policy | Metric Gym OS',
    description:
      'How Metric Gym OS collects, uses and protects gym and member data, including biometric access data, under Sri Lanka’s Personal Data Protection Act.',
    label: 'Privacy policy',
    parent: HOME_PATH,
    lastModified: '2026-09-01',
  },
  {
    path: '/terms',
    kind: 'legal',
    title: 'Terms of Service | Metric Gym OS',
    description:
      'The terms that govern use of Metric Gym OS by gyms and fitness centres, including subscriptions, SMS notifications and acceptable use.',
    label: 'Terms of service',
    parent: HOME_PATH,
    lastModified: '2026-07-01',
  },
  {
    path: '/refund-policy',
    kind: 'legal',
    title: 'Refund & Cancellation Policy | Metric Gym OS',
    description:
      'Free trial, monthly billing through PayHere, how to cancel a Metric Gym OS subscription and when refunds apply.',
    label: 'Refund & cancellation policy',
    parent: HOME_PATH,
    lastModified: '2026-07-01',
  },
] as const

const BY_PATH = new Map(MARKETING_PAGES.map((p) => [p.path, p]))

/** The registry entry for a path. Throws for an unregistered path. */
export function getMarketingPage(path: string): MarketingPage {
  const page = BY_PATH.get(path)
  if (!page) throw new Error(`No marketing page registered for "${path}"`)
  return page
}

/** Home → … → page, following `parent`. */
export function breadcrumbTrail(path: string): MarketingPage[] {
  const trail: MarketingPage[] = []
  let current: MarketingPage | undefined = getMarketingPage(path)
  while (current) {
    trail.unshift(current)
    current = current.parent ? BY_PATH.get(current.parent) : undefined
  }
  return trail
}

export const FEATURE_PAGES = MARKETING_PAGES.filter((p) => p.kind === 'feature')
export const ARTICLE_PAGES = MARKETING_PAGES.filter((p) => p.kind === 'article')
