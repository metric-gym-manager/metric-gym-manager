'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

/**
 * Builds the page-item list with truncation, e.g. `[1, '…', 4, 5, 6, '…', 20]`.
 * Exported for testing and reuse.
 */
export function getPaginationRange(
  page: number,
  pageCount: number,
  siblingCount = 1
): (number | 'ellipsis')[] {
  const totalNumbers = siblingCount * 2 + 5
  if (pageCount <= totalNumbers) {
    return Array.from({ length: pageCount }, (_, i) => i + 1)
  }
  const left = Math.max(page - siblingCount, 1)
  const right = Math.min(page + siblingCount, pageCount)
  const showLeftEllipsis = left > 2
  const showRightEllipsis = right < pageCount - 1

  const items: (number | 'ellipsis')[] = [1]
  if (showLeftEllipsis) items.push('ellipsis')
  for (let i = Math.max(left, 2); i <= Math.min(right, pageCount - 1); i++) {
    items.push(i)
  }
  if (showRightEllipsis) items.push('ellipsis')
  items.push(pageCount)
  return items
}

/**
 * Pagination — page navigation (spec §11 Navigation → Pagination). 1-based.
 * Renders nothing for a single page. Semantic <nav> with `aria-current="page"`
 * on the active page for accessibility.
 */
export interface PaginationProps {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  siblingCount?: number
  /**
   * Collapse to Prev · "2 of 3" · Next on a phone (mobile rebuild plan §5.6).
   *
   * Numbered pages need seven 32 px targets in a row; at 320 px that is the
   * full width with nothing left for the row count, and each target is well
   * under the §15.1 minimum. The compact form keeps both controls at the dense
   * 40 px size and states the position in words.
   *
   * Both forms are rendered and one is hidden by CSS — deliberately not a
   * `useViewportTier()` switch. There is no composition difference to reason
   * about here, and CSS cannot mismatch on hydration.
   */
  responsive?: boolean
  className?: string
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  siblingCount = 1,
  responsive,
  className,
}: PaginationProps) {
  if (pageCount <= 1) return null
  const items = getPaginationRange(page, pageCount, siblingCount)
  const go = (p: number) => onPageChange(Math.min(Math.max(p, 1), pageCount))

  const prev = (
    <Button
      size="icon"
      variant="ghost"
      aria-label="Previous page"
      disabled={page <= 1}
      onClick={() => go(page - 1)}
      className="phone:size-touch-sm"
    >
      <ChevronLeft />
    </Button>
  )
  const next = (
    <Button
      size="icon"
      variant="ghost"
      aria-label="Next page"
      disabled={page >= pageCount}
      onClick={() => go(page + 1)}
      className="phone:size-touch-sm"
    >
      <ChevronRight />
    </Button>
  )

  return (
    <nav
      aria-label="Pagination"
      // Pagination controls are secondary/dense targets (§15.1): 40, not 44.
      // Set on the container so the numbered buttons and the compact readout
      // are all covered by one marker.
      data-dense=""
      className={cn('flex items-center gap-1', className)}
    >
      {prev}

      <span className={cn('contents', responsive && 'phone:hidden')}>
        {items.map((item, i) =>
          item === 'ellipsis' ? (
            <span
              key={`ellipsis-${i}`}
              aria-hidden="true"
              className="inline-flex h-8 w-8 items-center justify-center font-geist text-body text-ink-muted"
            >
              …
            </span>
          ) : (
            <Button
              key={item}
              size="icon"
              variant={item === page ? 'accent' : 'ghost'}
              aria-label={`Page ${item}`}
              aria-current={item === page ? 'page' : undefined}
              onClick={() => go(item)}
              className="font-mono tabular-nums phone:size-touch-sm"
            >
              {item}
            </Button>
          )
        )}
      </span>

      {responsive && (
        <span
          // Not `aria-hidden`: the numbered buttons carrying
          // `aria-current="page"` are `display: none` at this width, so they
          // are out of the accessibility tree and this readout is the only
          // statement of where the user is. The visible text is "2 of 3"; the
          // screen reader hears "Page 2 of 3".
          className="hidden min-w-16 justify-center whitespace-nowrap px-2 font-mono text-mono-sm text-ink-secondary tabular-nums phone:inline-flex"
        >
          <span className="sr-only">Page&nbsp;</span>
          {page} of {pageCount}
        </span>
      )}

      {next}
    </nav>
  )
}
