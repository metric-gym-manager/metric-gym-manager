/**
 * Marketing Feature — Public API
 *
 * The public website as a domain: the registry of indexable pages, the site's
 * identity (name, company, address, contact), published pricing, the metadata
 * and structured data every public page emits, and the shared marketing UI.
 *
 * Consumers: the `(marketing)` route group, the homepage, the legal pages'
 * metadata, `app/sitemap.ts` and `app/robots.ts`. Nothing here reads a
 * session, a Supabase client or tenant data — every public page stays
 * statically prerendered, which is what `auth-config.ts` requires of a route
 * before it may join PUBLIC_ROUTES.
 *
 * Reference: docs/seo/SEO_AUDIT.md (architecture, linking and schema model).
 */

// ============================================================
// CONFIG
// ============================================================
export {
  SITE_URL,
  SITE_NAME,
  LEGAL_NAME,
  POSTAL_ADDRESS,
  CONTACT,
  SUPPORT_HOURS,
  SOCIAL_PROFILES,
  OG_IMAGE,
  absoluteUrl,
} from './config/site'
export {
  MARKETING_PAGES,
  FEATURE_PAGES,
  ARTICLE_PAGES,
  HOME_PATH,
  HUB_PATH,
  PRICING_PATH,
  ABOUT_PATH,
  CONTACT_PATH,
  RESOURCES_PATH,
  FEATURE_PATHS,
  ARTICLE_PATHS,
  getMarketingPage,
  breadcrumbTrail,
} from './config/pages'
export { FITNESS_EMPIRE } from './config/caseStudies'
export {
  PRICING_TIERS,
  TRIAL_DAYS,
  LITE_MEMBER_LIMIT,
  PRICE_CURRENCY,
  formatLkr,
  lowestMonthlyPriceLkr,
} from './config/pricing'
export {
  SMS_SAMPLE,
  SAMPLE_REMINDER_BEFORE_DUE,
  SAMPLE_REMINDER_DUE_TODAY,
  SAMPLE_RECEIPT,
  sampleWelcomeSms,
} from './config/sms-samples'
export {
  HEADER_LINKS,
  FOOTER_GROUPS,
  SIGN_UP_PATH,
  LOG_IN_PATH,
  prefetchFor,
} from './config/navigation'

// ============================================================
// SERVICES
// ============================================================
export { buildSitemap, buildRobots } from './services/crawl'

// ============================================================
// UTILS (metadata + structured data)
// ============================================================
export { buildPageMetadata } from './utils/metadata'
export { formatDisplayDate } from './utils/format'
export {
  ORGANIZATION_ID,
  WEBSITE_ID,
  SOFTWARE_ID,
  organizationJsonLd,
  websiteJsonLd,
  softwareApplicationJsonLd,
  breadcrumbJsonLd,
  webPageJsonLd,
  articleJsonLd,
  graph,
  serializeJsonLd,
} from './utils/structured-data'

// ============================================================
// SCHEMAS
// ============================================================
export { marketingPageSchema } from './schemas/marketing.schemas'

// ============================================================
// COMPONENTS
// ============================================================
export { MarketingShell } from './components/MarketingShell'
export { MarketingHero } from './components/MarketingHero'
export { MarketingSection, Prose } from './components/MarketingSection'
export { FeatureLinkGrid } from './components/FeatureLinkGrid'
export { FaqSection } from './components/FaqSection'
export { CallToAction } from './components/CallToAction'
export { PricingPlans } from './components/PricingPlans'
export { RelatedPages } from './components/RelatedPages'
export { CheckList } from './components/CheckList'
export { StructuredData } from './components/StructuredData'

// ============================================================
// TYPES
// ============================================================
export type * from './types'
