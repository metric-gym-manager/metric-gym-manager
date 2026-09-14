import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Switch — toggle control (spec §11 Selection Controls, §10 Toggle States).
 * Track 34×19, knob 13×13 (exact spec control geometry). Works controlled
 * (`checked` + `onCheckedChange`) or uncontrolled (`defaultChecked`). Renders a
 * real button with `role="switch"` + `aria-checked` for accessibility.
 *
 * `tone="accent"` (default) is for settings/non-status toggles; `tone="success"`
 * is for on/off status where green communicates the active state.
 */
export interface SwitchProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'type'
> {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  tone?: 'accent' | 'success'
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked,
      defaultChecked,
      onCheckedChange,
      disabled,
      tone = 'accent',
      className,
      onClick,
      ...props
    },
    ref
  ) => {
    const [internal, setInternal] = React.useState(!!defaultChecked)
    const isControlled = checked !== undefined
    const on = isControlled ? checked : internal

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e)
      if (disabled) return
      const next = !on
      if (!isControlled) setInternal(next)
      onCheckedChange?.(next)
    }

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          // Track — 34×19 with 10px radius (radius.2xl), per spec §11 Toggle.
          // Phone: 44×24 (mobile rebuild plan §5.2). The track IS the target
          // here — unlike Checkbox/Radio there is no wrapping label to carry
          // the hit area — so it is the widest control at 24 px tall.
          'relative inline-flex h-[19px] w-[34px] shrink-0 cursor-pointer items-center rounded-sm border border-line-2 transition-colors duration-fast ease-out focus-visible:shadow-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 phone:h-6 phone:w-11',
          on
            ? tone === 'success'
              ? 'bg-success'
              : 'bg-accentui'
            : 'bg-surface-input',
          className
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn(
            // Knob — 13×13 circle; travels 2px → 17px (spec §10 Toggle States).
            // Phone: 20×20 travelling 2px → 20px, which is the same geometry
            // (track − knob − 2 − two 1px borders) at the larger track size.
            'pointer-events-none absolute h-[13px] w-[13px] rounded-full transition-[left] duration-fast ease-out phone:h-5 phone:w-5',
            on
              ? 'left-[17px] bg-accentui-text phone:left-[20px]'
              : 'left-0.5 bg-solid'
          )}
        />
      </button>
    )
  }
)
Switch.displayName = 'Switch'
