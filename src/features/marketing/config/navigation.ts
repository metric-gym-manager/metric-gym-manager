/**
 * Public-site navigation — the ONE list of marketing links.
 *
 * Header and footer both render from here (and the homepage footer too), so a
 * page cannot be reachable from one and orphaned from the other. Labels come
 * from the page registry; anchors are deliberately descriptive and varied
 * rather than one repeated exact-match phrase.
 */

import {
  ABOUT_PATH,
  ARTICLE_PATHS,
  CONTACT_PATH,
  FEATURE_PATHS,
  HUB_PATH,
  PRICING_PATH,
  RESOURCES_PATH,
  getMarketingPage,
} from './pages'

export interface NavLink {
  href: string
  label: string
}

const link = (href: string, label?: string): NavLink => ({
  href,
  label: label ?? getMarketingPage(href).label,
})

/** Header links (desktop; the footer carries everything on a phone). */
export const HEADER_LINKS: readonly NavLink[] = [
  link(HUB_PATH, 'Product'),
  link(PRICING_PATH),
  link(RESOURCES_PATH),
  link(ABOUT_PATH),
]

export interface FooterGroup {
  heading: string
  links: readonly NavLink[]
}

export const FOOTER_GROUPS: readonly FooterGroup[] = [
  {
    heading: 'Product',
    links: [
      link(HUB_PATH, 'Gym management software'),
      link(FEATURE_PATHS.membership),
      link(FEATURE_PATHS.payments),
      link(FEATURE_PATHS.sms),
      link(FEATURE_PATHS.revenue),
      link(FEATURE_PATHS.access),
      link(PRICING_PATH),
    ],
  },
  {
    heading: 'Resources',
    links: [
      link(RESOURCES_PATH, 'All resources'),
      link(ARTICLE_PATHS.choose),
      link(ARTICLE_PATHS.reminders),
      link(ARTICLE_PATHS.overdue),
      link(ARTICLE_PATHS.move),
      link(ARTICLE_PATHS.compare),
      link(ARTICLE_PATHS.revenue),
    ],
  },
  {
    heading: 'Company',
    links: [link(ABOUT_PATH), link(CONTACT_PATH), link('/login', 'Log in')],
  },
  {
    heading: 'Legal',
    links: [link('/privacy'), link('/terms'), link('/refund-policy')],
  },
]

export const SIGN_UP_PATH = '/register'
export const LOG_IN_PATH = '/login'
