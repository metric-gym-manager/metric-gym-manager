import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Toolbar — generic action bar with start/end slots (Layer 3 composite). Used
 * above tables and content regions. Business-free layout container.
 */
export interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  start?: React.ReactNode
  end?: React.ReactNode
}

export function Toolbar({
  start,
  end,
  className,
  children,
  ...props
}: ToolbarProps) {
  return (
    <div
      role="toolbar"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3',
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          <div className="flex flex-wrap items-center gap-2">{start}</div>
          <div className="flex flex-wrap items-center gap-2">{end}</div>
        </>
      )}
    </div>
  )
}
