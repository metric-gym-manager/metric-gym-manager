import { Fragment } from 'react'
import {
  Breadcrumb,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui'
import { breadcrumbTrail } from '../config/pages'

/**
 * Visible breadcrumb trail, mirrored by the BreadcrumbList JSON-LD that
 * StructuredData emits from the same `breadcrumbTrail()`, so the markup can
 * only ever describe the trail a visitor sees.
 */
export function MarketingBreadcrumbs({ path }: { path: string }) {
  const trail = breadcrumbTrail(path)
  const current = trail[trail.length - 1]
  return (
    <Breadcrumb className="flex-wrap gap-y-1 text-sm">
      {trail.slice(0, -1).map((page) => (
        <Fragment key={page.path}>
          <BreadcrumbLink href={page.path}>{page.label}</BreadcrumbLink>
          <BreadcrumbSeparator />
        </Fragment>
      ))}
      <BreadcrumbPage className="font-normal text-ink-secondary">
        {current.label}
      </BreadcrumbPage>
    </Breadcrumb>
  )
}
