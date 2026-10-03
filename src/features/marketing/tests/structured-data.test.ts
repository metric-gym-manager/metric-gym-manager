/**
 * @jest-environment node
 */
import { ARTICLE_PATHS, FEATURE_PATHS, breadcrumbTrail } from '../config/pages'
import { PRICING_TIERS } from '../config/pricing'
import {
  CONTACT,
  LEGAL_NAME,
  POSTAL_ADDRESS,
  SITE_NAME,
  SITE_URL,
} from '../config/site'
import {
  ORGANIZATION_ID,
  articleJsonLd,
  breadcrumbJsonLd,
  graph,
  organizationJsonLd,
  serializeJsonLd,
  softwareApplicationJsonLd,
  websiteJsonLd,
} from '../utils/structured-data'

type Node = Record<string, unknown>

describe('Organization', () => {
  const org = organizationJsonLd() as Node

  it('names the product as the organization and the company as its legal name', () => {
    expect(org['@type']).toBe('Organization')
    expect(org.name).toBe(SITE_NAME)
    expect(org.legalName).toBe(LEGAL_NAME)
    expect(org.url).toBe(`${SITE_URL}/`)
  })

  it('uses exactly the contact details printed on /contact', () => {
    expect(org.email).toBe(CONTACT.supportEmail)
    expect(org.telephone).toBe(CONTACT.phoneE164)
    expect(org.address).toMatchObject({
      streetAddress: POSTAL_ADDRESS.streetAddress,
      addressLocality: POSTAL_ADDRESS.addressLocality,
      addressCountry: 'LK',
    })
  })

  it('claims no social profiles that do not exist (SEO-040)', () => {
    expect(org).not.toHaveProperty('sameAs')
  })
})

describe('SoftwareApplication', () => {
  const app = softwareApplicationJsonLd() as Node
  const offers = app.offers as Node[]

  it('has one offer per published tier, priced in LKR', () => {
    expect(offers.map((o) => [o.name, o.price, o.priceCurrency])).toEqual(
      PRICING_TIERS.map((t) => [t.name, String(t.monthlyPriceLkr), 'LKR'])
    )
  })

  it('carries no rating or review — none exist to mark up honestly', () => {
    expect(app).not.toHaveProperty('aggregateRating')
    expect(app).not.toHaveProperty('review')
  })

  it('is published by the site organization', () => {
    expect(app.publisher).toEqual({ '@id': ORGANIZATION_ID })
  })
})

describe('BreadcrumbList', () => {
  it('mirrors the visible trail, positions counting from 1', () => {
    const list = breadcrumbJsonLd(FEATURE_PATHS.access) as Node
    const items = list.itemListElement as Node[]
    const trail = breadcrumbTrail(FEATURE_PATHS.access)
    expect(items.map((i) => i.position)).toEqual(trail.map((_, i) => i + 1))
    expect(items.map((i) => i.name)).toEqual(trail.map((p) => p.label))
    expect(items[items.length - 1].item).toBe(
      `${SITE_URL}${FEATURE_PATHS.access}`
    )
  })
})

describe('Article', () => {
  it('dates the article from the registry and credits the organization', () => {
    const article = articleJsonLd(ARTICLE_PATHS.revenue) as Node
    expect(article.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(article.author).toEqual({ '@id': ORGANIZATION_ID })
    expect(String(article.headline)).not.toContain('|')
  })

  it('refuses to describe a non-article page as one', () => {
    expect(() => articleJsonLd(FEATURE_PATHS.sms)).toThrow()
  })
})

describe('serialisation', () => {
  it('produces valid JSON that cannot close its <script> element', () => {
    const doc = graph(websiteJsonLd(), {
      '@type': 'Thing',
      name: '</script><b>',
    })
    const text = serializeJsonLd(doc)
    expect(text).not.toContain('</script>')
    expect(JSON.parse(text)['@graph'][1].name).toBe('</script><b>')
  })
})
