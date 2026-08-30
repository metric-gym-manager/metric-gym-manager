import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Badge — status signal (directive §5.7 "Status — signal, not decoration").
 *
 * Renders as `● ACTIVE`: a small status dot plus an uppercase mono label, with
 * **no fill and no border**. Colour communicates state and stays sparse; the
 * chip treatment it replaced put a tinted rectangle around every status in
 * every table row, which is decoration competing with the data (§6 bans
 * excessive pill controls, §9.3 flags excessive badges).
 *
 * The dot is automatic for the coloured variants, so status is never conveyed
 * by colour alone — the label always carries it (§5.7, WCAG 1.4.1).
 *
 * `chip` restores a bordered container for the exceptional case where a badge
 * must read as a discrete object rather than an inline status — a variant, not
 * a second component (§10 "variants over separate components").
 */
export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-mono-sm uppercase tracking-wide leading-4',
  {
    variants: {
      variant: {
        neutral: 'text-ink-secondary',
        success: 'text-success',
        warning: 'text-warning',
        error: 'text-error',
        accent: 'text-brand-link',
      },
      chip: {
        true: 'rounded-sm border px-1.5 py-px',
        false: '',
      },
    },
    compoundVariants: [
      { chip: true, variant: 'neutral', class: 'border-line-2' },
      {
        chip: true,
        variant: 'success',
        class: 'border-success-border bg-success-bg',
      },
      {
        chip: true,
        variant: 'warning',
        class: 'border-warning-border bg-warning-bg',
      },
      {
        chip: true,
        variant: 'error',
        class: 'border-error-border bg-error-bg',
      },
      {
        chip: true,
        variant: 'accent',
        class: 'border-accentui-border bg-accentui-bg',
      },
    ],
    defaultVariants: { variant: 'neutral', chip: false },
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
  /**
   * Show the leading status dot. Defaults to `true` for the coloured variants
   * and `false` for `neutral`, which is used for non-status labels.
   */
  dot?: boolean
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, chip, dot, children, ...props }, ref) => {
    const showDot = dot ?? (variant != null && variant !== 'neutral')
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, chip }), className)}
        {...props}
      >
        {showDot && (
          <span
            aria-hidden="true"
            className={cn(
              'inline-block size-1.5 shrink-0 rounded-full',
              dotColor[variant ?? 'neutral']
            )}
          />
        )}
        {children}
      </span>
    )
  }
)
Badge.displayName = 'Badge'
