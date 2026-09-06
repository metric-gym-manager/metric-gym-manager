import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Label — form field label (spec §11 Inputs → Labels): 11px uppercase, 0.08em
 * tracking, muted color. `optional` appends a lowercase "(optional)" hint in the
 * placeholder color (spec §13: required fields carry no asterisk).
 */
export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  optional?: boolean
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, optional, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        'flex items-center gap-1 font-geist text-metadata uppercase text-ink-muted',
        className
      )}
      {...props}
    >
      {children}
      {optional && (
        <span className="font-normal normal-case tracking-normal text-ink-muted">
          (optional)
        </span>
      )}
    </label>
  )
)
Label.displayName = 'Label'

/**
 * HelperText — mono helper / validation text below a field (spec §11 Helper Text).
 */
const helperToneClass = {
  muted: 'text-ink-muted',
  error: 'text-error',
  warning: 'text-warning',
  success: 'text-success',
} as const

export interface HelperTextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  tone?: keyof typeof helperToneClass
}

export const HelperText = React.forwardRef<
  HTMLParagraphElement,
  HelperTextProps
>(({ className, tone = 'muted', ...props }, ref) => (
  <p
    ref={ref}
    className={cn('font-mono text-mono-sm', helperToneClass[tone], className)}
    {...props}
  />
))
HelperText.displayName = 'HelperText'
