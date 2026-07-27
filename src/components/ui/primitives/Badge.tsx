import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Badge — status chip (spec §11 Badges / Status Chips). Follows the status tint
 * recipe (text / 10% bg / 25% border) via semantic tokens. Mono, 11px, 4px
 * radius. Colour communicates status; a `dot` and screen-reader label keep it
 * from being colour-only (spec §8: status is never colour alone).
 */
export const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 py-px font-mono text-mono-sm leading-4',
  {
    variants: {
      variant: {
        neutral: 'border-line-2 bg-transparent text-ink-secondary',
        success: 'border-success-border bg-success-bg text-success',
        warning: 'border-warning-border bg-warning-bg text-warning',
        error: 'border-error-border bg-error-bg text-error',
        accent: 'border-accentui-border bg-accentui-bg text-brand-link',
      },
    },
    defaultVariants: { variant: 'neutral' },
  }
)

const dotColor: Record<NonNullable<BadgeProps['variant']>, string> = {
  neutral: 'bg-ink-muted',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  accent: 'bg-accentui',
}

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Show a leading status dot. */
  dot?: boolean
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, dot, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn(
            'inline-block size-1.5 rounded-full',
            dotColor[variant ?? 'neutral']
          )}
        />
      )}
      {children}
    </span>
  )
)
Badge.displayName = 'Badge'
