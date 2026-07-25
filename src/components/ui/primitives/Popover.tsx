'use client'

import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'

/**
 * Popover — floating panel anchored to a trigger (spec §1 Progressive disclosure).
 * Built on Radix Popover: focus management, Escape, outside-click, and ARIA.
 * Content is portalled with an explicit `data-theme` seam for dark surfaces.
 */
export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverAnchor = PopoverPrimitive.Anchor

export interface PopoverContentProps extends React.ComponentPropsWithoutRef<
  typeof PopoverPrimitive.Content
> {
  theme?: 'light' | 'dark'
}

export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  PopoverContentProps
>(({ className, align = 'center', sideOffset = 6, theme, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      data-theme={theme}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-modal-nested w-72 rounded-lg border border-line-2 bg-surface-card p-3 font-geist text-body text-ink shadow-overlay animate-pal-in focus:outline-none',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName
