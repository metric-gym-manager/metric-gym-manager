import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Divider — hairline separator (spec §2 Border Tokens: 1px solid border.1).
 * Horizontal by default; pass `orientation="vertical"` inside a flex row. An
 * optional `label` renders centered text between two rules.
 */
export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical'
  label?: React.ReactNode
}

export const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
  ({ className, orientation = 'horizontal', label, ...props }, ref) => {
    if (orientation === 'vertical') {
      return (
        <div
          ref={ref}
          role="separator"
          aria-orientation="vertical"
          className={cn('w-px self-stretch bg-line-1', className)}
          {...props}
        />
      )
    }

    if (label) {
      return (
        <div
          ref={ref}
          role="separator"
          className={cn(
            'flex items-center gap-3 text-metadata uppercase text-ink-muted',
            className
          )}
          {...props}
        >
          <span className="h-px flex-1 bg-line-1" />
          {label}
          <span className="h-px flex-1 bg-line-1" />
        </div>
      )
    }

    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation="horizontal"
        className={cn('h-px w-full bg-line-1', className)}
        {...props}
      />
    )
  }
)
Divider.displayName = 'Divider'
