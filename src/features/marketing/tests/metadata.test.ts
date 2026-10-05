/**
 * @jest-environment node
 *
 * Node, not jsdom: Next's URL resolver reads `URLSearchParams.size`, which
 * jsdom does not implement, so under jsdom the emitted-canonical tests below
 * would describe a runtime Next never renders in.
 */
import fs from 'node:fs'
import path from 'node:path'
import { resolveAlternates } from 'next/dist/lib/metadata/resolvers/resolve-basics'
import { resolveOpenGraph } from 'next/dist/lib/metadata/resolvers/resolve-opengraph'
import {
  ARTICLE_PATHS,
  HUB_PATH,
  MARKETING_PAGES,
  getMarketingPage,
} from '../config/pages'
import { OG_IMAGE, SITE_URL, absoluteUrl } from '../config/site'
import { buildPageMetadata } from '../utils/metadata'

describe('buildPageMetadata', () => {
  it('sets an absolute canonical on the www host, and the same og:url', () => {
    const meta = buildPageMetadata(HUB_PATH)
    expect(meta.alternates?.canonical).toBe(`${SITE_URL}${HUB_PATH}`)
    expect(meta.openGraph?.url).toBe(`${SITE_URL}${HUB_PATH}`)
  })

  it('uses the registry title verbatim, bypassing the root template', () => {
    const meta = buildPageMetadata(HUB_PATH)
    expect(meta.title).toEqual({ absolute: getMarketingPage(HUB_PATH).title })
    expect(meta.description).toBe(getMarketingPage(HUB_PATH).description)
  })

  it('always ships the 1200×630 share image (Next merges openGraph shallowly)', () => {
    const images = buildPageMetadata(HUB_PATH).openGraph?.images
    expect(images).toEqual([
      expect.objectContaining({ url: OG_IMAGE.path, width: 1200, height: 630 }),
    ])
  })

  it('marks articles as articles with their dates', () => {
    const og = buildPageMetadata(ARTICLE_PATHS.reminders, { type: 'article' })
      .openGraph as Record<string, unknown>
    expect(og.type).toBe('article')
    expect(og.publishedTime).toBe(
      getMarketingPage(ARTICLE_PATHS.reminders).published
    )
  })

  // The metadata OBJECT. Next emits the root without the slash; the test of
  // what reaches the HTML is "the canonical Next emits" below.
  it('canonicalises the homepage to the root with a trailing slash', () => {
    expect(buildPageMetadata('/').alternates?.canonical).toBe(`${SITE_URL}/`)
  })
})

/**
 * What a crawler reads is not the metadata object but the `<link
 * rel="canonical">` Next renders from it, and the two differ: for the root
 * path Next's URL resolver drops the trailing slash, so the homepage's
 * `https://www.metricgymos.com/` is emitted as `https://www.metricgymos.com`
 * (checked against the prerendered `.next/server/app/index.html`). The tests
 * above pin the object; this pins the emitted value, through the same
 * resolvers Next runs at render time.
 *
 * Those resolvers are internal (`next/dist/...`). If a Next upgrade moves
 * them this import fails loudly, which is the point: how canonicals are
 * emitted is exactly what an upgrade could change.
 */
describe('the canonical Next emits', () => {
  // `trailingSlash` is unset in next.config.js, so Next's default (false).
  const context = { trailingSlash: false, isStaticMetadataRouteFile: false }
  const metadataBase = new URL(SITE_URL)

  const emitted = async (pagePath: string) => {
    const meta = buildPageMetadata(pagePath)
    const pathname = Promise.resolve(pagePath)
    const alternates = await resolveAlternates(
      meta.alternates ?? null,
      metadataBase,
      pathname,
      context
    )
    const openGraph = await resolveOpenGraph(
      meta.openGraph ?? null,
      metadataBase,
      pathname,
      context,
      null
    )
    return {
      canonical: String(alternates?.canonical?.url),
      ogUrl: String(openGraph?.url),
    }
  }

  it('emits the homepage as the bare www origin', async () => {
    expect((await emitted('/')).canonical).toBe(SITE_URL)
  })

  it.each(MARKETING_PAGES.map((p) => p.path))(
    '%s: an absolute www URL, the same in og:url',
    async (pagePath) => {
      const { canonical, ogUrl } = await emitted(pagePath)
      expect(canonical).toBe(
        pagePath === '/' ? SITE_URL : absoluteUrl(pagePath)
      )
      expect(ogUrl).toBe(canonical)
    }
  )
})

/**
 * The root layout's metadata is inherited by EVERY route. A canonical or an
 * og:url there declares the whole site a duplicate of the homepage — which is
 * how every page came to share og:url https://metricgymos.com (SEO-004/007).
 * Read as source: importing the layout pulls in next/font and the providers.
 */
describe('root layout metadata', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src', 'app', 'layout.tsx'),
    'utf8'
  )
  const metadataBlock = source.slice(
    source.indexOf('export const metadata'),
    source.indexOf('export default function RootLayout')
  )

  it('sets no canonical and no og:url', () => {
    const openGraph = metadataBlock.slice(
      metadataBlock.indexOf('openGraph:'),
      metadataBlock.indexOf('twitter:')
    )
    expect(openGraph.length).toBeGreaterThan(0)
    expect(metadataBlock).not.toMatch(/canonical/)
    // The only `url:` allowed in openGraph is the image's, read from config.
    expect(openGraph.match(/\burl:\s*([^,\n]+)/g)).toEqual([
      'url: OG_IMAGE.path',
    ])
  })

  it('builds absolute URLs on the canonical origin, not the redirecting apex', () => {
    expect(metadataBlock).toMatch(/metadataBase:\s*new URL\(SITE_URL\)/)
    expect(SITE_URL).toBe('https://www.metricgymos.com')
  })
})

/**
 * SEO-010: the middleware answers 307 → /login for every route below these
 * layouts, so none is crawlable today. The noindex is the second line, for the
 * day a route is served without a session; it cannot be rendered in a test
 * (no session), so it is pinned at the source like the root layout above.
 */
describe('signed-in route groups', () => {
  it.each(['(dashboard)', '(admin)', '(dev)'])(
    '%s layout declares noindex, nofollow',
    (group) => {
      const source = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', group, 'layout.tsx'),
        'utf8'
      )
      expect(source).toMatch(
        /export const metadata: Metadata = \{\s*robots: \{ index: false, follow: false \}/
      )
    }
  )
})
