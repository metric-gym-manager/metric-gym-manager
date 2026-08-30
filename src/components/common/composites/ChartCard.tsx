import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardBody } from '@/components/ui'
import { SectionHeader } from './SectionHeader'

/**
 * ChartCard — a titled chart region (Layer 3 composite).
 *
 * Renders as a **section, not a card** (directive §5.16: "integrate into the
 * information surface … without a heavy ChartCard"). A label row, a hairline,
 * and the chart — the data is the visual, so the container stops competing
 * with it. This also keeps `Page → Section → Chart` inside the maximum
 * containment depth of one (§5.3); the old `Card` wrapper made every chart on
 * a carded page a second nested boundary.
 *
 * `boxed` restores the card container for the exceptional case where a chart is
 * a standalone object (§5.4) — a variant, not a second component (§10).
 *
 * The name is retained because it is the established import across the app;
 * renaming it would churn call sites for no behavioural gain.
 */
export interface ChartCardProps {
  title: React.ReactNode
  description?: React.ReactNode
  /** Unit or magnitude indicator, e.g. "LKR" or "×1,000". */
  scale?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  /** Draw a bordered container. Exceptional — see §5.4. */
  boxed?: boolean
  className?: string
  bodyClassName?: string
}

export function ChartCard({
  title,
  description,
  scale,
  actions,
  children,
  boxed = false,
  className,
  bodyClassName,
}: ChartCardProps) {
  const header = (
    <SectionHeader
      variant="metadata"
      divider
      title={title}
      description={description}
      className={cn(boxed && 'px-4 pt-3')}
      actions={
        (scale || actions) && (
          <>
            {scale && (
              <span className="font-mono text-mono-sm text-ink-muted">
                {scale}
              </span>
            )}
            {actions}
          </>
        )
      }
    />
  )

  if (boxed) {
    return (
      <Card className={className}>
        {header}
        <CardBody className={bodyClassName}>{children}</CardBody>
      </Card>
    )
  }

  return (
    <section className={cn('font-geist', className)}>
      {header}
      <div className={cn('pt-3', bodyClassName)}>{children}</div>
    </section>
  )
}
