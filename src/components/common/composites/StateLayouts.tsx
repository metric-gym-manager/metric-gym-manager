import { cn } from '@/lib/utils'
import {
  EmptyState,
  type EmptyStateProps,
  Skeleton,
  SkeletonText,
} from '@/components/ui'

/**
 * EmptyStateLayout — a full-region empty state centered in a min-height area,
 * optionally bordered as a card (Layer 3 composite; spec §14 Empty States).
 */
export interface EmptyStateLayoutProps extends EmptyStateProps {
  minHeight?: number
  bordered?: boolean
}

export function EmptyStateLayout({
  minHeight = 320,
  bordered = true,
  className,
  ...emptyProps
}: EmptyStateLayoutProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center',
        bordered && 'rounded-lg border border-line-1 bg-surface-card',
        className
      )}
      style={{ minHeight }}
    >
      <EmptyState {...emptyProps} />
    </div>
  )
}

/**
 * LoadingLayout — skeleton scaffolding for data-dependent regions (spec §17:
 * "Skeletons over spinners"). A polite busy region; the shape approximates the
 * content it replaces. `cards` for stat grids, `list` for tables, `detail` for
 * record panels.
 */
export interface LoadingLayoutProps {
  variant?: 'list' | 'cards' | 'detail'
  rows?: number
  label?: string
  className?: string
}

export function LoadingLayout({
  variant = 'list',
  rows = 5,
  label = 'Loading',
  className,
}: LoadingLayoutProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn('w-full', className)}
    >
      <span className="sr-only">{label}</span>

      {variant === 'cards' && (
        <div className="grid grid-cols-1 gap-3 tablet:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-lg border border-line-1 bg-surface-card p-4"
            >
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </div>
      )}

      {variant === 'list' && (
        <div className="overflow-hidden rounded-lg border border-line-1 bg-surface-card">
          <div className="border-b border-line-1 px-4 py-3">
            <Skeleton className="h-3 w-28" />
          </div>
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-line-subtle px-4 py-3 last:border-0"
            >
              <Skeleton circle className="size-6.5" />
              <Skeleton className="h-3 flex-1 max-w-[220px]" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      )}

      {variant === 'detail' && (
        <div className="flex flex-col gap-4 rounded-lg border border-line-1 bg-surface-card p-4">
          <div className="flex items-center gap-3">
            <Skeleton circle className="size-10" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <SkeletonText lines={rows} />
        </div>
      )}
    </div>
  )
}
