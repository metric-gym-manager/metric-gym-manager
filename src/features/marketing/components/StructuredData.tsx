import { getMarketingPage } from '../config/pages'
import {
  ORGANIZATION_ID,
  SOFTWARE_ID,
  breadcrumbJsonLd,
  graph,
  organizationJsonLd,
  serializeJsonLd,
  webPageJsonLd,
  websiteJsonLd,
  type JsonLd,
} from '../utils/structured-data'

/**
 * The JSON-LD for one public page, as a single `@graph`.
 *
 * Organization and WebSite are included on every page so the `@id`
 * references in WebPage, Article and SoftwareApplication resolve inside the
 * same document. The WebPage is `about` the product only on pages that carry
 * the SoftwareApplication node (and show its prices), and `about` the company
 * on /about; elsewhere it names no subject rather than one the page does not
 * describe. A plain <script> rather than next/script: structured data is
 * data, not executable code (Next.js JSON-LD guide).
 */
export function StructuredData({
  path,
  nodes = [],
  breadcrumbs = true,
}: {
  path: string
  /** Page-specific nodes, e.g. SoftwareApplication or Article. */
  nodes?: JsonLd[]
  breadcrumbs?: boolean
}) {
  const about = nodes.some((node) => node['@id'] === SOFTWARE_ID)
    ? SOFTWARE_ID
    : getMarketingPage(path).kind === 'company'
      ? ORGANIZATION_ID
      : undefined
  const data = graph(
    organizationJsonLd(),
    websiteJsonLd(),
    webPageJsonLd(path, about),
    ...(breadcrumbs ? [breadcrumbJsonLd(path)] : []),
    ...nodes
  )
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  )
}
