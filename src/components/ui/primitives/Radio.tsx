import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Radio — native <input type="radio"> (spec §11 Selection Controls). Group
 * several by sharing a `name`. Pass `label` for a clickable label wrapper.
 *
 * Phone sizing matches Checkbox (mobile rebuild plan §5.2, §15.1): a 24 px
 * control inside a 44 px label hit area.
 */
export interface RadioProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  label?: React.ReactNode
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, label, id, disabled, ...props }, ref) => {
    const reactId = React.useId()
    const controlId = id ?? reactId

    const input = (
      <input
        ref={ref}
        id={controlId}
        type="radio"
        disabled={disabled}
        className={cn(
          'size-3.5 shrink-0 cursor-pointer accent-brand-accent focus-visible:shadow-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 phone:size-6',
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
          'inline-flex cursor-pointer items-center gap-2 font-geist text-body text-ink phone:min-h-touch phone:gap-3',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        {input}
        <span>{label}</span>
      </label>
    )
  }
)
Radio.displayName = 'Radio'
