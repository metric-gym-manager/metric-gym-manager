import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * EmptyState — centered no-data / no-results / error placeholder (spec §14 Empty,
 * Error & System States). Icon 26px muted, 13px medium heading, 13px muted
 * description, optional action.
 */
export interface EmptyStateProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'title'
> {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-12 text-center font-geist',
        className
      )}
      {...props}
    >
      {icon && <div className="text-ink-muted [&_svg]:size-6.5">{icon}</div>}
      <h3 className="text-body font-medium text-ink">{title}</h3>
      {description && (
        <p className="max-w-sm text-body text-ink-muted">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
)
EmptyState.displayName = 'EmptyState'
