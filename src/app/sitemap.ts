import type { MetadataRoute } from 'next'
import { buildSitemap } from '@/features/marketing'

/**
 * /sitemap.xml — one entry per page in the public page registry
 * (features/marketing/config/pages.ts). Statically generated at build.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap()
}
