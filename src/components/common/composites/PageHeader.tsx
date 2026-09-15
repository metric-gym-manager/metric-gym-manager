import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * PageHeader — page-level heading with optional breadcrumb slot, description, and
 * a right-aligned action cluster (Layer 3 composite; spec §5 H1 / §3 layout).
 * Compose the breadcrumb from the `Breadcrumb` primitives.
 *
 * **On a phone the `<h1>` is hidden** (mobile rebuild plan §6.2): the `AppBar`
 * is already showing the page's name in fixed chrome, and a second copy of it
 * costs a quarter of a 568 px screen before any content. What remains is the
 * description and the `actions`, which become the page's first content row —
 * which is where a page's primary action belongs, since the AppBar
 * deliberately has no action slot (correction C7).
 *
 * The page keeps exactly one `<h1>` at every width: the AppBar's, on a phone;
 * this one, on a desktop. `sr-only` rather than `hidden`, so the heading stays
 * in the accessibility tree for a screen reader walking the document on the
 * `(admin)` routes, which have no AppBar above them.
 */
export interface PageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  breadcrumb?: React.ReactNode
  actions?: React.ReactNode
  /** Add a hairline divider beneath the header. */
  bordered?: boolean
  className?: string
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  bordered,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        bordered && 'border-b border-line-1 pb-4',
        className
      )}
    >
      {breadcrumb}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className={cn('min-w-0', !description && 'phone:contents')}>
          <h1 className="text-h1 text-ink phone:sr-only">{title}</h1>
          {description && (
            <p className="mt-1 text-body text-ink-muted phone:mt-0">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  )
}
