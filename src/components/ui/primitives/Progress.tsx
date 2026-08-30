import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Progress — determinate linear progress / meter (spec §13: password-strength bar
 * transitions width and color). Token-driven fill with a proper
 * `role="progressbar"` and value ARIA. Provide an `aria-label` (or wrap with a
 * visible label via `aria-labelledby`).
 */
const toneClass = {
  accent: 'bg-accentui',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
} as const

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  tone?: keyof typeof toneClass
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, max = 100, tone = 'accent', ...props }, ref) => {
    const pct = Math.min(Math.max((value / max) * 100, 0), 100)
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
        className={cn(
          'h-1.5 w-full overflow-hidden rounded-xs bg-surface-input',
          className
        )}
        {...props}
      >
        <div
          className={cn(
            'h-full rounded-xs transition-[width,background-color] duration-fast',
            toneClass[tone]
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    )
  }
)
Progress.displayName = 'Progress'
