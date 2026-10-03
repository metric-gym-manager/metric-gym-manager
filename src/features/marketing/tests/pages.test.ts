/**
 * @jest-environment node
 */
import fs from 'node:fs'
import path from 'node:path'
import { isPublicRoute, isAuthRoute } from '@/lib/auth-config'
import {
  MARKETING_PAGES,
  breadcrumbTrail,
  getMarketingPage,
} from '../config/pages'
import { marketingPageSchema } from '../schemas/marketing.schemas'

const APP = path.join(process.cwd(), 'src', 'app')

/** Every page.tsx under src/app, mapped to the URL path it serves. */
function routeMap(): Map<string, string[]> {
  const routes = new Map<string, string[]>()
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name.startsWith('api')) continue
        walk(full)
      } else if (entry.name === 'page.tsx') {
        const segments = path
          .relative(APP, path.dirname(full))
          .split(path.sep)
          .filter((s) => s && !/^\(.*\)$/.test(s)) // route groups add no segment
        const url = `/${segments.join('/')}`
        routes.set(url, [...(routes.get(url) ?? []), path.relative(APP, full)])
      }
    }
  }
  walk(APP)
  return routes
}

describe('public page registry', () => {
  it.each(MARKETING_PAGES.map((p) => [p.path, p]))(
    '%s satisfies the registry schema',
    (_path, page) => {
      const result = marketingPageSchema.safeParse(page)
      expect(result.success ? [] : result.error.issues).toEqual([])
    }
  )

  it('has unique paths, titles and descriptions', () => {
    const unique = (key: 'path' | 'title' | 'description') =>
      new Set(MARKETING_PAGES.map((p) => p[key])).size
    expect(unique('path')).toBe(MARKETING_PAGES.length)
    expect(unique('title')).toBe(MARKETING_PAGES.length)
    expect(unique('description')).toBe(MARKETING_PAGES.length)
  })

  /**
   * The promise that matters most to a crawler: a page that is not in
   * PUBLIC_ROUTES answers every anonymous visitor — Googlebot included — with
   * 307 → /login, while rendering perfectly in every other test.
   */
  it.each(MARKETING_PAGES.map((p) => p.path))(
    '%s is served to signed-out visitors (PUBLIC_ROUTES)',
    (pagePath) => {
      expect(isPublicRoute(pagePath)).toBe(true)
      // …and is not an auth page a signed-in user would be bounced from.
      expect(isAuthRoute(pagePath)).toBe(false)
    }
  )

  it('every registered page has a page module under src/app', () => {
    const routes = routeMap()
    const missing = MARKETING_PAGES.map((p) => p.path).filter(
      (p) => !routes.has(p)
    )
    expect(missing).toEqual([])
  })

  /**
   * Two page modules once resolved to "/" — the landing page and a dead
   * `(dashboard)/page.tsx` redirect. Turbopack kept the landing page by a
   * silent tie-break; webpack refuses to build; and if the tie-break ever
   * flipped, the homepage would become a redirect to /login and drop out of
   * the index (SEO-008).
   */
  it('exactly one page module serves each URL — and "/" is the landing page', () => {
    const routes = routeMap()
    const duplicates = [...routes.entries()].filter(
      ([, files]) => files.length > 1
    )
    expect(duplicates).toEqual([])
    expect(routes.get('/')).toEqual(['page.tsx'])
  })

  it('every parent exists, so breadcrumb trails start at the homepage', () => {
    for (const page of MARKETING_PAGES) {
      const trail = breadcrumbTrail(page.path)
      expect(trail[0].path).toBe('/')
      expect(trail[trail.length - 1].path).toBe(page.path)
    }
  })

  it('throws for an unregistered path rather than inventing metadata', () => {
    expect(() => getMarketingPage('/not-a-page')).toThrow(/No marketing page/)
  })

  it('never dates a page in the future', () => {
    const today = new Date().toISOString().slice(0, 10)
    for (const page of MARKETING_PAGES) {
      expect(page.lastModified <= today).toBe(true)
      if (page.published) expect(page.published <= page.lastModified).toBe(true)
    }
  })
})
