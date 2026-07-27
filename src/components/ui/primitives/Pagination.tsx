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
  className?: string
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  siblingCount = 1,
  className,
}: PaginationProps) {
  if (pageCount <= 1) return null
  const items = getPaginationRange(page, pageCount, siblingCount)
  const go = (p: number) => onPageChange(Math.min(Math.max(p, 1), pageCount))

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex items-center gap-1', className)}
    >
      <Button
        size="icon"
        variant="ghost"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => go(page - 1)}
      >
        <ChevronLeft />
      </Button>

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
            className="font-mono tabular-nums"
          >
            {item}
          </Button>
        )
      )}

      <Button
        size="icon"
        variant="ghost"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => go(page + 1)}
      >
        <ChevronRight />
      </Button>
    </nav>
  )
}
