import type { MetadataRoute } from 'next'
import { MARKETING_PAGES } from '../config/pages'
import { SITE_URL, absoluteUrl } from '../config/site'

/**
 * Sitemap entries for every registered public page.
 *
 * Built from the registry, so publishing a page and listing it are the same
 * act. `lastModified` is the page's content date; `changeFrequency` and
 * `priority` are omitted because Google ignores both.
 */
export function buildSitemap(): MetadataRoute.Sitemap {
  return MARKETING_PAGES.map((page) => ({
    url: absoluteUrl(page.path),
    lastModified: page.lastModified,
  }))
}

/**
 * robots.txt. Everything is crawlable except the API. `/join/` stays allowed
 * on purpose: those pages carry `noindex`, and a crawler that may not fetch a
 * page can never read its noindex.
 */
export function buildRobots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: '/api/' }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
