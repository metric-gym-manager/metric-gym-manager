import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * SectionHeader — a titled section heading with optional description and actions
 * (Layer 3 composite; spec §5 H2/section). Business-free: pass content in.
 *
 * ```tsx
 * <SectionHeader title="Members" description="Everyone in this gym" actions={<Button/>} />
 * ```
 */
export interface SectionHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-h2 text-ink">{title}</h2>
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
