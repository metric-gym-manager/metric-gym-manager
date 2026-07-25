import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Table — semantic base table primitives (spec §11 Data Display → Tables, §10
 * Table Row States). Uses real <table> semantics for accessibility. Composite
 * behaviors (sort/filter/paginate/virtualize) build on top of these in Phase 2's
 * DataTable; this is the styling foundation every table shares.
 *
 * Wrap in <TableContainer> for the card border + horizontal scroll on mobile.
 */
export const TableContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'w-full overflow-x-auto rounded-lg border border-line-1 bg-surface-card',
      className
    )}
    {...props}
  />
))
TableContainer.displayName = 'TableContainer'

export const Table = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <table
    ref={ref}
    className={cn(
      'w-full border-collapse font-geist text-body text-ink',
      className
    )}
    {...props}
  />
))
Table.displayName = 'Table'

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={className} {...props} />
))
TableHeader.displayName = 'TableHeader'

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={className} {...props} />
))
TableBody.displayName = 'TableBody'

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean
  clickable?: boolean
}

export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, selected, clickable, ...props }, ref) => (
    <tr
      ref={ref}
      data-selected={selected || undefined}
      className={cn(
        'border-b border-line-subtle transition-colors duration-fast last:border-0',
        'hover:bg-surface-hover data-[selected=true]:bg-accentui-bg',
        clickable && 'cursor-pointer',
        className
      )}
      {...props}
    />
  )
)
TableRow.displayName = 'TableRow'

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /** Right-align + mono tabular numerics (spec: numeric columns). */
  numeric?: boolean
}

export const TableHead = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, numeric, ...props }, ref) => (
    <th
      ref={ref}
      scope="col"
      className={cn(
        'whitespace-nowrap border-b border-line-1 px-4 py-2 text-metadata uppercase text-ink-muted',
        numeric ? 'text-right' : 'text-left',
        className
      )}
      {...props}
    />
  )
)
TableHead.displayName = 'TableHead'

export const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, numeric, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        'px-4 py-2 align-middle',
        numeric && 'text-right font-mono tabular-nums',
        className
      )}
      {...props}
    />
  )
)
TableCell.displayName = 'TableCell'

/** Sticky header helper — apply to <TableHeader> inside a scrollable container. */
export const stickyHeaderClass = 'sticky top-0 z-sticky bg-surface-card'
