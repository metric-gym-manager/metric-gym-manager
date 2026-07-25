import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardBody } from '@/components/ui'

/**
 * ChartCard — a titled card wrapping a chart primitive (Layer 3 composite; spec
 * §15 chart header 11px metadata + scale indicator). Pass a chart primitive as
 * children; header shows the title, optional scale (e.g. "LKR ×1,000"), and
 * actions (e.g. a range Select).
 */
export interface ChartCardProps {
  title: React.ReactNode
  description?: React.ReactNode
  scale?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}

export function ChartCard({
  title,
  description,
  scale,
  actions,
  children,
  className,
  bodyClassName,
}: ChartCardProps) {
  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-3 border-b border-line-1 px-4 py-3">
        <div className="min-w-0">
          <span className="text-metadata uppercase text-ink-muted">
            {title}
          </span>
          {description && (
            <p className="mt-1 text-caption text-ink-muted">{description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {scale && (
            <span className="font-mono text-mono-sm text-ink-muted">
              {scale}
            </span>
          )}
          {actions}
        </div>
      </div>
      <CardBody className={cn(bodyClassName)}>{children}</CardBody>
    </Card>
  )
}
