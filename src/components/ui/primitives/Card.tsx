import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Card — surface container with slot-based composition (spec §11 Data Display →
 * Tables/Stat Cards; §1 "Minimal visual noise": elevation via hairline + surface,
 * never drop shadow). Compose:
 *
 * ```tsx
 * <Card>
 *   <CardHeader><CardTitle>Members</CardTitle><Button size="xs">Add</Button></CardHeader>
 *   <CardBody>…</CardBody>
 *   <CardFooter>…</CardFooter>
 * </Card>
 * ```
 */
export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-lg border border-line-1 bg-surface-card font-geist text-ink',
      className
    )}
    {...props}
  />
))
Card.displayName = 'Card'

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex items-center justify-between gap-3 border-b border-line-1 px-4 py-3',
      className
    )}
    {...props}
  />
))
CardHeader.displayName = 'CardHeader'

/** Card title — 14px semibold (spec typography scale: H3 = card titles). */
export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn('text-h3 text-ink', className)} {...props} />
))
CardTitle.displayName = 'CardTitle'

/** Dense panel-header label — 11px uppercase metadata (spec §11 App Shell). */
export const CardLabel = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn('text-metadata uppercase text-ink-muted', className)}
    {...props}
  />
))
CardLabel.displayName = 'CardLabel'

export const CardBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-4', className)} {...props} />
))
CardBody.displayName = 'CardBody'

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex items-center justify-end gap-2 border-t border-line-1 px-4 py-3',
      className
    )}
    {...props}
  />
))
CardFooter.displayName = 'CardFooter'
