import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * FilterBar — a toolbar specialized for filtering (Layer 3 composite; spec §12
 * tab/in-memory filtering). Slots a search control and filter controls on the
 * left, actions on the right. Generic — pass SearchBar/Select/Badge children in.
 */
export interface FilterBarProps {
  search?: React.ReactNode
  filters?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function FilterBar({
  search,
  filters,
  actions,
  className,
}: FilterBarProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {search}
        {filters}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  )
}
