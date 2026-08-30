'use client'

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

/**
 * Tooltip — hover/focus hint (spec §11 Tooltip: surface, radius.md, shadow.overlay,
 * 150ms fade). Built on Radix for keyboard + screen-reader support. Content is
 * NOT portalled so it stays inside the nearest theme scope.
 *
 * Wrap your app (or a subtree) in <TooltipProvider> once, then:
 * ```tsx
 * <Tooltip content="Copy ID"><Button size="icon"><Copy /></Button></Tooltip>
 * ```
 */
export const TooltipProvider = TooltipPrimitive.Provider

export interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  side?: TooltipPrimitive.TooltipContentProps['side']
  align?: TooltipPrimitive.TooltipContentProps['align']
  sideOffset?: number
  /** Provide a provider inline if there isn't one higher up. */
  standalone?: boolean
  delayDuration?: number
}

export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  sideOffset = 6,
  standalone = false,
  delayDuration = 200,
}: TooltipProps) {
  const tooltip = (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Content
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-toast max-w-xs rounded-sm border border-line-2 bg-surface-card px-2 py-1 font-geist text-mono-sm text-ink shadow-overlay',
          'animate-fade-in'
        )}
      >
        {content}
        <TooltipPrimitive.Arrow className="fill-surface-card" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Root>
  )

  return standalone ? <TooltipProvider>{tooltip}</TooltipProvider> : tooltip
}
