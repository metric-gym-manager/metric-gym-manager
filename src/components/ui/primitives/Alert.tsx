import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Alert — inline, in-flow status message (spec §11 Toast / Inline Alert; §14
 * Empty/Error/System States). Status tint recipe, no emoji. Error/warning use
 * `role="alert"` (assertive); info/success use `role="status"` (polite).
 * Pass a leading `icon` and an optional `onDismiss`.
 */
export const alertVariants = cva(
  'flex items-start gap-2 rounded-md border px-3 py-2.5 font-geist text-body',
  {
    variants: {
      variant: {
        neutral: 'border-line-2 bg-surface-card text-ink',
        info: 'border-accentui-border bg-accentui-bg text-ink',
        success: 'border-success-border bg-success-bg text-success',
        warning: 'border-warning-border bg-warning-bg text-warning',
        error: 'border-error-border bg-error-bg text-error',
      },
    },
    defaultVariants: { variant: 'neutral' },
  }
)

export interface AlertProps
  extends
    Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof alertVariants> {
  icon?: React.ReactNode
  title?: React.ReactNode
  onDismiss?: () => void
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      className,
      variant = 'neutral',
      icon,
      title,
      onDismiss,
      children,
      ...props
    },
    ref
  ) => {
    const assertive = variant === 'error' || variant === 'warning'
    return (
      <div
        ref={ref}
        role={assertive ? 'alert' : 'status'}
        aria-live={assertive ? 'assertive' : 'polite'}
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        {icon && (
          <span className="mt-px shrink-0 [&_svg]:size-3.5">{icon}</span>
        )}
        <div className="min-w-0 flex-1">
          {title && <p className="font-medium">{title}</p>}
          {children && (
            <div className={cn(title && 'mt-0.5', 'text-ink-secondary')}>
              {children}
            </div>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="-mr-1 -mt-0.5 shrink-0 rounded-sm p-0.5 text-ink-muted transition-colors duration-fast hover:text-ink focus-visible:shadow-focus focus-visible:outline-none"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    )
  }
)
Alert.displayName = 'Alert'
