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
        // `phone:` only — every desktop height below is unchanged. `min-h`
        // rather than `h` so the declared height stays the desktop value and
        // the phone floor simply wins over it (§15.1: 44 primary, 40 dense).
        xs: 'h-6.5 gap-1.5 rounded-sm px-2.5 text-button-sm phone:min-h-touch-sm phone:min-w-touch-sm phone:px-3',
        sm: 'h-7.5 rounded-sm px-3 text-button-sm phone:min-h-touch-sm phone:min-w-touch-sm',
        md: 'h-8 rounded-sm px-3 text-button phone:min-h-touch',
        lg: 'h-9 rounded-sm px-4 text-button phone:min-h-touch',
        xl: 'h-10 rounded-sm px-4 text-button-lg phone:min-h-touch',
        // Icon-only: the glyph stays 14 px (`[&_svg]:size-3.5`); the HIT AREA
        // grows to 44. Scaling the glyph instead is what §15.1 forbids.
        icon: 'h-8 w-8 rounded-sm p-0 phone:size-touch',
      },
    },
    compoundVariants: [
      // The link variant is inline text, not a boxed control.
      {
        variant: 'link',
        size: ['xs', 'sm', 'md', 'lg', 'xl', 'icon'],
        // A standalone text link is still a target: §15.1 gives it the dense
        // box (40) on a phone. `min-h`/`min-w` leave `h-auto` and the zero
        // padding intact, so the label does not move on desktop.
        class: 'h-auto border-0 p-0 phone:min-h-touch-sm phone:min-w-touch-sm',
      },
    ],
    defaultVariants: { variant: 'secondary', size: 'md' },
  }
)

/**
 * Sizes that carry the §15.1 *dense* target (40) rather than the primary one
 * (44), and are marked `data-dense` so the probe holds them to it. `link` is
 * dense through its compound variant. The set is here, beside the classes it
 * must agree with — a second copy in the probe or a screen is how the rule
 * grows a third threshold.
 */
const DENSE_SIZES = new Set(['xs', 'sm'])

/** `data-dense` when the resolved size/variant is a dense target. */
function denseAttr(
  variant: ButtonProps['variant'],
  size: ButtonProps['size']
): '' | undefined {
  return DENSE_SIZES.has(size ?? 'md') || variant === 'link' ? '' : undefined
}

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
          data-dense={denseAttr(variant, size)}
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
        data-dense={denseAttr(variant, size)}
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
