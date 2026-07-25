import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * PageHeader — page-level heading with optional breadcrumb slot, description, and
 * a right-aligned action cluster (Layer 3 composite; spec §5 H1 / §3 layout).
 * Compose the breadcrumb from the `Breadcrumb` primitives.
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
        <div className="min-w-0">
          <h1 className="text-h1 text-ink">{title}</h1>
          {description && (
            <p className="mt-1 text-body text-ink-muted">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  )
}
