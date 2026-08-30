import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Select — native <select> (spec §11 Inputs → Select). Native element for full
 * keyboard + platform accessibility; a chevron affordance is layered on top.
 * Set `error` (or `aria-invalid`) for the error treatment.
 */
export const selectVariants = cva(
  'w-full cursor-pointer appearance-none border bg-surface-input pr-8 font-geist text-body text-ink transition-[color,box-shadow,border-color] duration-normal ease-out hover:border-line-hover focus-visible:border-focusring focus-visible:shadow-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface-base disabled:opacity-60 aria-[invalid=true]:border-error aria-[invalid=true]:focus-visible:shadow-focus-error',
  {
    variants: {
      size: {
        md: 'h-8 rounded-sm pl-2',
        lg: 'h-9 rounded-sm pl-2.5',
      },
    },
    defaultVariants: { size: 'md' },
  }
)

export interface SelectProps
  extends
    Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'>,
    VariantProps<typeof selectVariants> {
  error?: boolean
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, size, error, children, ...props }, ref) => (
    <div className="relative w-full">
      <select
        ref={ref}
        className={cn(selectVariants({ size }), className)}
        {...props}
        aria-invalid={error ? true : props['aria-invalid']}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
      />
    </div>
  )
)
Select.displayName = 'Select'
