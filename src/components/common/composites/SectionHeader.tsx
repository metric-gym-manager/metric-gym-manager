import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * SectionHeader — the heading for a region of a page (Layer 3 composite).
 *
 * Two registers, because an operational surface uses both:
 * - `heading` (default) — a 16px section title, for a page division a reader
 *   navigates by.
 * - `metadata` — an 11px uppercase tracked label (`REVENUE`, `EXPIRY QUEUE`),
 *   which is how the directive labels operational regions (§5.8). Pair it with
 *   `divider` and the section reads as an instrument panel rather than a card.
 *
 * `divider` draws the hairline that separates the label from its content. That
 * hairline — not a border wrapped around everything — is what carries structure
 * once containers are removed (§5.2, §5.12).
 *
 * This is the single section-header implementation; `ChartCard` composes it.
 */
export interface SectionHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  variant?: 'heading' | 'metadata'
  divider?: boolean
  className?: string
}

export function SectionHeader({
  title,
  description,
  actions,
  variant = 'heading',
  divider = false,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4',
        divider && 'border-b border-line-1 pb-2',
        className
      )}
    >
      <div className="min-w-0">
        {variant === 'metadata' ? (
          <h2 className="text-metadata uppercase text-ink-muted">{title}</h2>
        ) : (
          <h2 className="text-h2 text-ink">{title}</h2>
        )}
        {description && (
          <p className="mt-1 text-caption text-ink-muted">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  )
}
