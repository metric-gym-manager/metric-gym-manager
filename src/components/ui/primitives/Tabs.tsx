'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

/**
 * Tabs — horizontal tabbed navigation (spec §11 Navigation → Tabs). 36px tall,
 * active tab marked by a 2px bottom border in the primary ink color. Built on
 * Radix Tabs: roving focus, arrow-key navigation, and correct ARIA.
 *
 * ```tsx
 * <Tabs defaultValue="all">
 *   <TabsList>
 *     <TabsTrigger value="all">All</TabsTrigger>
 *     <TabsTrigger value="due">Due</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="all">…</TabsContent>
 * </Tabs>
 * ```
 */
export const Tabs = TabsPrimitive.Root

export interface TabsListProps extends React.ComponentPropsWithoutRef<
  typeof TabsPrimitive.List
> {
  /**
   * How the strip behaves when the triggers do not fit (mobile rebuild plan
   * §5.5).
   *
   * - `fit` (default) — triggers share the width (`flex-1` on a phone). Right
   *   for two or three short labels.
   * - `scroll` — the strip scrolls sideways, snapping to triggers, with a
   *   trailing fade so a cut-off tab reads as "there is more". Right for a
   *   strip whose labels carry counts: `Expired 115 · Expires this week 39 ·
   *   Collected 125` is 397 px wide, and a phone browser meeting that widens
   *   its layout viewport and zooms the whole page out to fit it (finding F5).
   *
   * The scroller is marked `data-scroll="x"` — the one sanctioned way for
   * content to extend past a phone viewport (plan §17, ruling M1).
   */
  overflow?: 'fit' | 'scroll'
}

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, overflow = 'fit', ...props }, ref) => {
  const list = (
    <TabsPrimitive.List
      ref={ref}
      data-scroll={overflow === 'scroll' ? 'x' : undefined}
      className={cn(
        'flex items-center gap-0 border-b border-line-1',
        overflow === 'scroll'
          ? 'scrollbar-hide snap-x snap-mandatory overflow-x-auto'
          : // Nothing to scroll: share the room instead of truncating.
            'phone:[&>*]:flex-1',
        className
      )}
      {...props}
    />
  )

  if (overflow !== 'scroll') return list

  return (
    <div className="relative">
      {list}
      {/* Trailing-edge cue. Phone only: on desktop the strip fits, and a
          permanent gradient over a non-scrolling row is an artifact. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-6 bg-gradient-to-l from-surface-base to-transparent phone:block"
      />
    </div>
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    // A tab is a dense target (§15.1): 40, not 44. `data-dense` is what tells
    // the probe which threshold applies — without it the rule reads 44 and a
    // correct tab strip fails.
    data-dense=""
    className={cn(
      'relative inline-flex h-9 items-center whitespace-nowrap px-3.5 font-geist text-body font-medium text-ink-muted transition-colors duration-fast',
      'phone:min-h-touch-sm phone:snap-start phone:px-3',
      'hover:text-ink-secondary focus-visible:shadow-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=active]:text-ink',
      'data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:bg-ink data-[state=active]:after:content-[""]',
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('pt-4 focus-visible:outline-none', className)}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName
