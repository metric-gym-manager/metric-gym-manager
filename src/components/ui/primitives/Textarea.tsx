import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Textarea — multi-line text field (spec §11 Inputs → Textarea). Same styling as
 * Input with `resize: vertical` and 8px 10px padding. Set `error` (or
 * `aria-invalid`) for the error treatment.
 */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, rows = 3, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'min-h-16 w-full resize-y rounded-sm border bg-surface-input px-2.5 py-2 font-geist text-body leading-5 text-ink phone:text-input transition-[color,box-shadow,border-color] duration-normal ease-out placeholder:text-ink-muted hover:border-line-hover focus-visible:border-focusring focus-visible:shadow-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface-base disabled:opacity-60 read-only:bg-surface-base read-only:text-ink-secondary aria-[invalid=true]:border-error aria-[invalid=true]:focus-visible:shadow-focus-error',
        className
      )}
      {...props}
      aria-invalid={error ? true : props['aria-invalid']}
    />
  )
)
Textarea.displayName = 'Textarea'
