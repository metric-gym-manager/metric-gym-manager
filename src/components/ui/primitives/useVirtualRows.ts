'use client'

import * as React from 'react'

/**
 * useVirtualRows — minimal fixed-height row windowing (spec §17: tables >100 rows
 * must virtualize). Returns the visible slice plus top/bottom spacer heights so a
 * <table> can render only on-screen rows inside a scroll container. Dependency-free.
 */
export interface VirtualRowsResult<T> {
  start: number
  end: number
  topPad: number
  bottomPad: number
  visible: T[]
}

export function useVirtualRows<T>({
  rows,
  rowHeight,
  containerRef,
  overscan = 6,
  enabled = true,
}: {
  rows: T[]
  rowHeight: number
  containerRef: React.RefObject<HTMLElement | null>
  overscan?: number
  enabled?: boolean
}): VirtualRowsResult<T> {
  const [scrollTop, setScrollTop] = React.useState(0)
  const [viewport, setViewport] = React.useState(0)

  React.useEffect(() => {
    if (!enabled) return
    const el = containerRef.current
    if (!el) return
    const onScroll = () => setScrollTop(el.scrollTop)
    el.addEventListener('scroll', onScroll, { passive: true })
    setViewport(el.clientHeight)

    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => setViewport(el.clientHeight))
      ro.observe(el)
    }
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro?.disconnect()
    }
  }, [containerRef, enabled])

  if (!enabled || rowHeight <= 0) {
    return {
      start: 0,
      end: rows.length,
      topPad: 0,
      bottomPad: 0,
      visible: rows,
    }
  }

  const total = rows.length
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const visibleCount =
    Math.ceil((viewport || rowHeight * 12) / rowHeight) + overscan * 2
  const end = Math.min(total, start + visibleCount)

  return {
    start,
    end,
    topPad: start * rowHeight,
    bottomPad: Math.max(0, (total - end) * rowHeight),
    visible: rows.slice(start, end),
  }
}
