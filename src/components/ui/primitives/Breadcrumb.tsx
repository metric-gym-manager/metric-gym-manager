import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Breadcrumb — hierarchical location trail (spec §11 Navigation → Breadcrumbs).
 * "/" separator in the placeholder color; parent segments muted links, the
 * current page in primary ink, medium weight. Semantic <nav>/<ol> with
 * `aria-current="page"` on the active crumb.
 *
 * ```tsx
 * <Breadcrumb>
 *   <BreadcrumbLink href="/">Metric</BreadcrumbLink>
 *   <BreadcrumbSeparator />
 *   <BreadcrumbPage>Members</BreadcrumbPage>
 * </Breadcrumb>
 * ```
 */
export const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, children, ...props }, ref) => (
  <nav ref={ref} aria-label="Breadcrumb" {...props}>
    <ol
      className={cn('flex items-center gap-2 font-geist text-body', className)}
    >
      {children}
    </ol>
  </nav>
))
Breadcrumb.displayName = 'Breadcrumb'

export const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement>
>(({ className, ...props }, ref) => (
  <li className="inline-flex items-center">
    <a
      ref={ref}
      className={cn(
        'text-ink-muted transition-colors duration-fast hover:text-ink focus-visible:rounded-sm focus-visible:shadow-focus focus-visible:outline-none',
        className
      )}
      {...props}
    />
  </li>
))
BreadcrumbLink.displayName = 'BreadcrumbLink'

export function BreadcrumbSeparator({ className }: { className?: string }) {
  return (
    <li aria-hidden="true" className={cn('text-ink-placeholder', className)}>
      /
    </li>
  )
}

export const BreadcrumbPage = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <li className="inline-flex items-center">
    <span
      ref={ref}
      aria-current="page"
      className={cn('font-medium text-ink', className)}
      {...props}
    />
  </li>
))
BreadcrumbPage.displayName = 'BreadcrumbPage'
