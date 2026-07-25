import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Checkbox — native <input type="checkbox"> (spec §11 Selection Controls).
 * 14×14, accent-colored, with focus ring and disabled state. Pass `label` for a
 * clickable label wrapper, or omit it and wire your own via FormField.
 * Supports the `indeterminate` visual state.
 */
export interface CheckboxProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  label?: React.ReactNode
  indeterminate?: boolean
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, indeterminate, disabled, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement>(null)
    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement)
    React.useEffect(() => {
      if (innerRef.current) innerRef.current.indeterminate = !!indeterminate
    }, [indeterminate])

    const reactId = React.useId()
    const controlId = id ?? reactId

    const input = (
      <input
        ref={innerRef}
        id={controlId}
        type="checkbox"
        disabled={disabled}
        className={cn(
          'size-3.5 shrink-0 cursor-pointer rounded-sm border border-line-2 accent-brand-accent focus-visible:shadow-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    )

    if (!label) return input

    return (
      <label
        htmlFor={controlId}
        className={cn(
          'inline-flex cursor-pointer items-center gap-2 font-geist text-body text-ink',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        {input}
        <span>{label}</span>
      </label>
    )
  }
)
Checkbox.displayName = 'Checkbox'
