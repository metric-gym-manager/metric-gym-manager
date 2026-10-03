/**
 * @jest-environment node
 */
import { MARKETING_PAGES } from '../config/pages'
import { SITE_URL } from '../config/site'
import { buildRobots, buildSitemap } from '../services/crawl'

describe('sitemap', () => {
  const entries = buildSitemap()

  it('lists every registered page exactly once', () => {
    const urls = entries.map((e) => e.url)
    expect(new Set(urls).size).toBe(urls.length)
    expect(urls).toHaveLength(MARKETING_PAGES.length)
  })

  it('uses absolute URLs on the canonical www host, without trailing slashes on subpages', () => {
    for (const { url } of entries) {
      expect(url.startsWith(`${SITE_URL}/`)).toBe(true)
      expect(url).not.toMatch(/^https:\/\/metricgymos\.com/)
      if (url !== `${SITE_URL}/`) expect(url.endsWith('/')).toBe(false)
    }
  })

  it('reports each page’s content date, not the build time', () => {
    for (const entry of entries) {
      expect(entry.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('never lists private or utility routes', () => {
    const urls = entries.map((e) => new URL(e.url).pathname)
    for (const p of [
      '/login',
      '/register',
      '/dashboard',
      '/members',
      '/join',
    ]) {
      expect(urls).not.toContain(p)
    }
  })
})

describe('robots.txt', () => {
  const robots = buildRobots()
  const rules = Array.isArray(robots.rules) ? robots.rules : [robots.rules]

  it('allows the site, keeps crawlers out of the API, and names the sitemap', () => {
    expect(rules).toEqual([{ userAgent: '*', allow: '/', disallow: '/api/' }])
    expect(robots.sitemap).toBe(`${SITE_URL}/sitemap.xml`)
  })

  it('does not block /join/ — those pages carry noindex, which a blocked crawler could never read', () => {
    const disallowed = rules.flatMap((r) =>
      Array.isArray(r.disallow) ? r.disallow : [r.disallow]
    )
    expect(disallowed.some((d) => d && '/join/abc'.startsWith(d))).toBe(false)
  })
})
