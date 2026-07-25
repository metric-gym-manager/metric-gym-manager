import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Spinner } from './Spinner'

/**
 * Button — the single button primitive (spec §11 Buttons, §10 Button States).
 * Variant + size driven; every value comes from a design token. Supports the
 * full state matrix: default / hover / active(pressed) / focus-visible /
 * disabled / loading. Renders a real <button> for accessibility, or `asChild`
 * to project styles onto another element (e.g. an <a> for the Link variant).
 */
export const buttonVariants = cva(
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap border font-geist font-medium transition-colors duration-fast ease-out focus-visible:border-focusring focus-visible:shadow-focus focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-solid text-solid-text border-line-2 hover:bg-surface-card hover:text-ink active:bg-surface-base',
        secondary:
          'bg-transparent text-ink border-line-2 hover:border-line-hover active:bg-surface-hover',
        accent:
          'bg-accentui text-accentui-text border-line-3 hover:bg-accentui-hover',
        ghost:
          'bg-transparent text-ink border-transparent hover:bg-surface-hover active:bg-surface-active',
        destructive:
          'bg-danger text-danger-text border-line-3 hover:brightness-110',
        'destructive-ghost':
          'bg-transparent text-error border-error-border hover:bg-error-bg',
        'success-ghost':
          'bg-transparent text-success border-success-border hover:bg-success-bg',
        link: 'bg-transparent text-brand-link border-transparent underline-offset-4 hover:text-brand-link-hover hover:underline',
      },
      size: {
        xs: 'h-6.5 gap-1.5 rounded-md px-2.5 text-button-sm',
        sm: 'h-7.5 rounded-md px-3 text-button-sm',
        md: 'h-8 rounded-md px-3 text-button',
        lg: 'h-9 rounded-md px-4 text-button',
        xl: 'h-10 rounded-lg px-4 text-button-lg',
        icon: 'h-8 w-8 rounded-md p-0',
      },
    },
    compoundVariants: [
      // The link variant is inline text, not a boxed control.
      {
        variant: 'link',
        size: ['xs', 'sm', 'md', 'lg', 'xl', 'icon'],
        class: 'h-auto border-0 p-0',
      },
    ],
    defaultVariants: { variant: 'secondary', size: 'md' },
  }
)

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render styles onto the child element instead of a <button>. */
  asChild?: boolean
  /** Replace content with a centered spinner; preserves width to avoid layout shift. */
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      type,
      ...props
    },
    ref
  ) => {
    if (asChild) {
      return (
        <Slot
          ref={ref}
          className={cn(buttonVariants({ variant, size }), className)}
          {...props}
        >
          {children}
        </Slot>
      )
    }

    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          buttonVariants({ variant, size }),
          loading && 'cursor-wait',
          className
        )}
        {...props}
      >
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner size="sm" label="Loading" />
          </span>
        )}
        <span
          className={cn(
            'inline-flex items-center gap-2',
            loading && 'invisible'
          )}
        >
          {leftIcon}
          {children}
          {rightIcon}
        </span>
      </button>
    )
  }
)
Button.displayName = 'Button'
