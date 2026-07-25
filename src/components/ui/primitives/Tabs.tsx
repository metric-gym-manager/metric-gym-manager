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

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn('flex items-center gap-0 border-b border-line-1', className)}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'relative inline-flex h-9 items-center whitespace-nowrap px-3.5 font-geist text-body font-medium text-ink-muted transition-colors duration-fast',
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
