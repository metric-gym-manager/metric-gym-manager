import type { Metadata } from 'next'
import { getMarketingPage } from '../config/pages'
import { OG_IMAGE, SITE_NAME, absoluteUrl } from '../config/site'

/**
 * Next.js metadata for a registered public page.
 *
 * Three rules this exists to hold in one place:
 *
 * - The canonical is set PER PAGE, never in the root layout. A canonical in a
 *   layout is inherited by every page beneath it, which silently declares the
 *   whole site a duplicate of the homepage.
 * - `openGraph` is rebuilt in full. Next merges metadata shallowly, so a page
 *   that sets `openGraph.title` alone drops the inherited image, and a page
 *   that sets nothing inherits the parent's `og:url` — which is how every page
 *   on the site came to claim the homepage's URL.
 * - Titles are `absolute`: the registry holds the exact string that ships, so
 *   the root `%s | Metric Gym OS` template can never double the brand.
 */
export function buildPageMetadata(
  path: string,
  { type = 'website' }: { type?: 'website' | 'article' } = {}
): Metadata {
  const page = getMarketingPage(path)
  const url = absoluteUrl(page.path)
  const images = [
    {
      url: OG_IMAGE.path,
      width: OG_IMAGE.width,
      height: OG_IMAGE.height,
      alt: OG_IMAGE.alt,
    },
  ]

  return {
    title: { absolute: page.title },
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      type,
      url,
      siteName: SITE_NAME,
      title: page.title,
      description: page.description,
      locale: 'en_LK',
      images,
      ...(type === 'article' && page.published
        ? {
            publishedTime: page.published,
            modifiedTime: page.lastModified,
          }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
      images: [OG_IMAGE.path],
    },
  }
}
