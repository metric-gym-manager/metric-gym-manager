import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Input — single-line text field (spec §11 Inputs, §10 Input States). Covers
 * default / hover / focus / disabled / error / read-only. Set `error` (or
 * `aria-invalid`) for the error treatment. Optional leading/trailing icons power
 * the search-input pattern without a separate component.
 */
export const inputVariants = cva(
  'w-full border bg-surface-input font-geist text-body text-ink transition-[color,box-shadow,border-color] duration-normal ease-out placeholder:text-ink-muted hover:border-line-hover focus-visible:border-focusring focus-visible:shadow-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface-base disabled:opacity-60 read-only:bg-surface-base read-only:text-ink-secondary aria-[invalid=true]:border-error aria-[invalid=true]:focus-visible:shadow-focus-error',
  {
    variants: {
      size: {
        // `phone:` only — 32/36 px stay the desktop heights. `text-input` is
        // 16 px: below that, mobile Safari zooms the layout viewport on focus
        // and never zooms back (§5.1, §5.2).
        md: 'h-8 rounded-sm px-2.5 phone:min-h-touch phone:text-input', // 32px — app
        lg: 'h-9 rounded-sm px-3 phone:min-h-touch phone:text-input', // 36px — auth / modals
      },
    },
    defaultVariants: { size: 'md' },
  }
)

export interface InputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  error?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, size, leftIcon, rightIcon, error, ...props }, ref) => {
    const input = (
      <input
        ref={ref}
        className={cn(
          inputVariants({ size }),
          leftIcon && 'pl-8',
          rightIcon && 'pr-8',
          className
        )}
        {...props}
        aria-invalid={error ? true : props['aria-invalid']}
      />
    )

    if (!leftIcon && !rightIcon) return input

    return (
      <div className="relative w-full">
        {leftIcon && (
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted [&_svg]:size-3.5">
            {leftIcon}
          </span>
        )}
        {input}
        {rightIcon && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted [&_svg]:size-3.5">
            {rightIcon}
          </span>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'
