import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Skeleton — loading placeholder (spec §11 Loading / Skeleton, §17: "Skeletons
 * over spinners"). Decorative by default (`aria-hidden`); the surrounding region
 * should carry the busy/loading semantics. Shape it with width/height utilities.
 * The pulse animation collapses under `prefers-reduced-motion` (global rule).
 */
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  circle?: boolean
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, circle, ...props }, ref) => (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        'animate-pulse bg-surface-input',
        circle ? 'rounded-full' : 'rounded-sm',
        className
      )}
      {...props}
    />
  )
)
Skeleton.displayName = 'Skeleton'

/**
 * SkeletonText — N shimmer lines approximating a paragraph (spec §17:
 * hint-placeholder-count — match expected item count).
 */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3', i === lines - 1 && lines > 1 && 'w-3/5')}
        />
      ))}
    </div>
  )
}
