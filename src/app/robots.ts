import type { MetadataRoute } from 'next'
import { buildRobots } from '@/features/marketing'

/** /robots.txt — rules live in features/marketing/services/crawl.ts. */
export default function robots(): MetadataRoute.Robots {
  return buildRobots()
}
