/**
 * @deprecated Legacy shadcn primitive. Prefer the Metric Design System primitive
 * `Textarea` from '@/components/ui' — token-driven, light+dark, full state
 * matrix. Retained only until existing screens migrate off it.
 */
import * as React from 'react'

import { cn } from '@/lib/utils'

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[60px] w-full rounded-md border border-input bg-surface-input px-3 py-2 font-geist text-body leading-5 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = 'Textarea'

export { Textarea }
