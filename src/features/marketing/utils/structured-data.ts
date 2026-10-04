import {
  breadcrumbTrail,
  getMarketingPage,
  PRICING_PATH,
} from '../config/pages'
import { PRICE_CURRENCY, PRICING_TIERS } from '../config/pricing'
import {
  CONTACT,
  LEGAL_NAME,
  LOGO_PATH,
  OG_IMAGE,
  POSTAL_ADDRESS,
  SITE_NAME,
  SITE_URL,
  SOCIAL_PROFILES,
  SUPPORT_HOURS,
  absoluteUrl,
} from '../config/site'

/**
 * schema.org JSON-LD for the public site.
 *
 * Every value is read from the same config the visible pages render, so the
 * markup cannot state something the page does not. `sameAs` lists only the
 * profiles in SOCIAL_PROFILES, each also linked from /contact (SEO-040). One
 * thing is absent on purpose, and must stay absent until real evidence exists:
 *
 * - `aggregateRating` / `review` on SoftwareApplication. Google's software-app
 *   rich result requires one of them, so the result will not show — which is
 *   correct while there are no genuine, collected reviews to mark up.
 *
 * FAQPage and LocalBusiness were considered and rejected (SEO-031, SEO-032).
 */

export type JsonLd = Record<string, unknown>

export const ORGANIZATION_ID = `${SITE_URL}/#organization`
export const WEBSITE_ID = `${SITE_URL}/#website`
export const SOFTWARE_ID = `${SITE_URL}/#software`

export function organizationJsonLd(): JsonLd {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE_NAME,
    legalName: LEGAL_NAME,
    url: `${SITE_URL}/`,
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl(LOGO_PATH),
      width: 512,
      height: 512,
    },
    email: CONTACT.supportEmail,
    telephone: CONTACT.phoneE164,
    address: {
      '@type': 'PostalAddress',
      streetAddress: POSTAL_ADDRESS.streetAddress,
      addressLocality: POSTAL_ADDRESS.addressLocality,
      addressCountry: POSTAL_ADDRESS.addressCountry,
    },
    sameAs: SOCIAL_PROFILES.map((profile) => profile.url),
    areaServed: { '@type': 'Country', name: 'Sri Lanka' },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        telephone: CONTACT.phoneE164,
        email: CONTACT.supportEmail,
        areaServed: 'LK',
        availableLanguage: 'English',
        hoursAvailable: {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          opens: SUPPORT_HOURS.opens,
          closes: SUPPORT_HOURS.closes,
        },
      },
    ],
  }
}

export function websiteJsonLd(): JsonLd {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    inLanguage: 'en',
    publisher: { '@id': ORGANIZATION_ID },
  }
}

export function softwareApplicationJsonLd(): JsonLd {
  return {
    '@type': 'SoftwareApplication',
    '@id': SOFTWARE_ID,
    name: SITE_NAME,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Gym management software',
    operatingSystem: 'Web browser',
    url: `${SITE_URL}/`,
    description:
      'Cloud gym management software for Sri Lankan gyms: member records, renewals and payment tracking, automated SMS reminders, revenue and member analytics, and fingerprint door access.',
    image: absoluteUrl(OG_IMAGE.path),
    publisher: { '@id': ORGANIZATION_ID },
    offers: PRICING_TIERS.map((t) => ({
      '@type': 'Offer',
      name: t.name,
      description: t.summary,
      price: String(t.monthlyPriceLkr),
      priceCurrency: PRICE_CURRENCY,
      url: absoluteUrl(PRICING_PATH),
      eligibleRegion: { '@type': 'Country', name: 'Sri Lanka' },
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: String(t.monthlyPriceLkr),
        priceCurrency: PRICE_CURRENCY,
        unitCode: 'MON',
        referenceQuantity: {
          '@type': 'QuantitativeValue',
          value: 1,
          unitCode: 'MON',
        },
      },
    })),
  }
}

export function breadcrumbJsonLd(path: string): JsonLd {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbTrail(path).map((page, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: page.label,
      item: absoluteUrl(page.path),
    })),
  }
}

/**
 * @param about - `@id` of the entity the page is about. Pass one only when
 *   that entity is also in the page's graph and the visible page describes it;
 *   otherwise omit it (a guide or the contact page is not "about" the product).
 */
export function webPageJsonLd(path: string, about?: string): JsonLd {
  const page = getMarketingPage(path)
  return {
    '@type': 'WebPage',
    '@id': `${absoluteUrl(page.path)}#webpage`,
    url: absoluteUrl(page.path),
    name: page.title,
    description: page.description,
    isPartOf: { '@id': WEBSITE_ID },
    ...(about ? { about: { '@id': about } } : {}),
    dateModified: page.lastModified,
    inLanguage: 'en',
  }
}

export function articleJsonLd(path: string): JsonLd {
  const page = getMarketingPage(path)
  if (page.kind !== 'article' || !page.published) {
    throw new Error(`"${path}" is not an article with a publication date`)
  }
  return {
    '@type': 'Article',
    '@id': `${absoluteUrl(page.path)}#article`,
    mainEntityOfPage: absoluteUrl(page.path),
    // The visible headline: the <title> without the brand suffix.
    headline: page.title.replace(` | ${SITE_NAME}`, ''),
    description: page.description,
    datePublished: page.published,
    dateModified: page.lastModified,
    image: absoluteUrl(OG_IMAGE.path),
    inLanguage: 'en',
    author: { '@id': ORGANIZATION_ID },
    publisher: { '@id': ORGANIZATION_ID },
  }
}

/**
 * One `@graph` document. Entities referenced by `@id` are resolved within the
 * graph, so a page that mentions the publisher must also include it.
 */
export function graph(...nodes: JsonLd[]): JsonLd {
  return { '@context': 'https://schema.org', '@graph': nodes }
}

/**
 * Serialise for a <script type="application/ld+json">. `<` is escaped so a
 * string can never close the script element (the Next.js JSON-LD guide's
 * recommendation); the result is still valid JSON.
 */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
