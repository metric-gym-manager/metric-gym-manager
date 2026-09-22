'use client'

import * as React from 'react'
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useViewportTier } from '@/hooks/useViewportTier'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from './Table'
import { Checkbox } from './Checkbox'
import { Input } from './Input'
import { EmptyState } from './EmptyState'
import { Alert } from './Alert'
import { ListRow } from './ListRow'
import { Select } from './Select'
import { Skeleton, SkeletonText } from './Skeleton'
import { Pagination } from './Pagination'
import { useVirtualRows } from './useVirtualRows'

/**
 * DataTable — the reusable data grid every table screen composes (spec §11 Tables,
 * §14 States, §17 Performance). One implementation of: sorting, global filter,
 * row selection + bulk actions, sticky header, client pagination, loading
 * skeletons, empty + error states, expandable rows, opt-in virtualization, and
 * opt-in column resizing (drag or keyboard).
 *
 * Business tables pass typed `columns` + `data`; they never restyle table chrome.
 */
export type SortDirection = 'asc' | 'desc'

export interface DataTableColumn<T> {
  id: string
  header: React.ReactNode
  /** Cell renderer. Defaults to the row's value at `id` if it is a key of T. */
  cell?: (row: T) => React.ReactNode
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number
  /** Right-align + mono tabular numerics. */
  numeric?: boolean
  className?: string
  headerClassName?: string
  width?: string
  /** Allow the user to drag-resize this column (adds a keyboard-accessible handle). */
  resizable?: boolean
  /** Minimum width (px) when resizing. Defaults to 80. */
  minWidth?: number
}

/**
 * Column ids mapped onto `ListRow`'s slots (plan §9.3).
 *
 * Every field except `leading` names a column in `columns`; an id that names
 * no column renders nothing rather than throwing, because a table that loses
 * its phone layout is better than a screen that will not mount.
 */
export interface DataTableMobileRow<T> {
  /** The record's name. Required. */
  primary: string
  /**
   * Status line — usually the column whose `cell` renders a `Badge`.
   *
   * Accepts SEVERAL column ids, like `meta`, because a status line is often a
   * state plus the date that state is about: Members reads "● EXPIRED ·
   * 16/09/2026" from two separate columns (plan §8.2), and the desktop table
   * must keep them as two sortable columns. §9.3 wrote this as a single id;
   * §8.2 needs two, and widening it is the only way to satisfy both without
   * adding a column the desktop would have to hide.
   */
  status?: string | string[]
  /** Secondary meta columns, in order. */
  meta?: string[]
  /** The trailing figure. */
  value?: string
  /** Row actions. */
  actions?: string
  /** Defaults to the selection checkbox when `selectable`. */
  leading?: (row: T) => React.ReactNode
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  getRowId: (row: T) => string
  caption?: string

  // Sorting (uncontrolled)
  defaultSort?: { columnId: string; direction: SortDirection }

  // Filtering
  searchable?: boolean
  searchPlaceholder?: string
  /** Externally controlled query (overrides the built-in search box value). */
  globalFilter?: string
  /** Custom match predicate; defaults to a case-insensitive scan of cell text. */
  filterFn?: (row: T, query: string) => boolean

  // Selection
  selectable?: boolean
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  bulkActions?: (selectedRows: T[]) => React.ReactNode

  // Pagination (client-side)
  pageSize?: number

  // Rows
  onRowClick?: (row: T) => void
  renderExpanded?: (row: T) => React.ReactNode

  // States
  loading?: boolean
  loadingRowCount?: number
  error?: React.ReactNode
  empty?: React.ReactNode

  // Layout
  stickyHeader?: boolean
  maxBodyHeight?: number

  /**
   * How this table renders on a phone (mobile rebuild plan §9.3).
   *
   * A declarative mapping from column ids onto the `ListRow` slots — not a
   * `renderMobileRow` JSX prop, which would put a different row layout in
   * every feature, and not column-priority metadata, which is still a squeezed
   * table. The list path reuses this table's own `columns` (`cell` for
   * formatting, `header` as a hidden label, `sortValue` for the compact sort
   * control) and shares filtering, pagination, selection and every state with
   * the table path.
   *
   * **A column not named here is not rendered in the row.** That is the point
   * of §9.4: information stays *accessible*, not simultaneously visible, and
   * each list declares where the rest of it lives.
   *
   * Without this prop a table stays a table at every width.
   */
  mobileRow?: DataTableMobileRow<T>

  /**
   * Force a layout instead of deciding from the viewport tier. For the
   * showcase and for tests — jsdom has no width, so a list-mode test has to
   * say which path it means.
   */
  forceLayout?: 'table' | 'list'

  // Virtualization (opt-in; needs maxBodyHeight + rowHeight)
  virtualize?: boolean
  rowHeight?: number

  // Column resizing (opt-in per column via column.resizable)
  onColumnResize?: (columnId: string, width: number) => void
  /** Persist resized widths to localStorage under this key. */
  storageKey?: string

  className?: string
}

function defaultFilter<T>(
  row: T,
  query: string,
  columns: DataTableColumn<T>[]
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return columns.some((col) => {
    const raw = col.sortValue
      ? col.sortValue(row)
      : (row as Record<string, unknown>)[col.id]
    return String(raw ?? '')
      .toLowerCase()
      .includes(q)
  })
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  caption,
  defaultSort,
  searchable,
  searchPlaceholder = 'Search…',
  globalFilter,
  filterFn,
  selectable,
  selectedIds,
  onSelectionChange,
  bulkActions,
  pageSize,
  onRowClick,
  renderExpanded,
  loading,
  loadingRowCount = 5,
  error,
  empty,
  stickyHeader,
  maxBodyHeight,
  mobileRow,
  forceLayout,
  virtualize,
  rowHeight = 41,
  onColumnResize,
  storageKey,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = React.useState<{
    columnId: string
    direction: SortDirection
  } | null>(defaultSort ?? null)
  const [internalQuery, setInternalQuery] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [internalSelected, setInternalSelected] = React.useState<string[]>([])
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // ── Column resizing ──────────────────────────────────────────────────────
  const hasResizable = React.useMemo(
    () => columns.some((c) => c.resizable),
    [columns]
  )
  const [colWidths, setColWidths] = React.useState<Record<string, number>>(
    () => {
      if (typeof window !== 'undefined' && storageKey) {
        try {
          const raw = window.localStorage.getItem(storageKey)
          if (raw) return JSON.parse(raw) as Record<string, number>
        } catch {
          /* ignore malformed storage */
        }
      }
      return {}
    }
  )
  const colWidthsRef = React.useRef(colWidths)
  const thRefs = React.useRef<Record<string, HTMLTableCellElement | null>>({})
  const dragRef = React.useRef<{
    id: string
    startX: number
    startWidth: number
    min: number
  } | null>(null)

  // Keep the ref in sync for event handlers, and persist if requested.
  React.useEffect(() => {
    colWidthsRef.current = colWidths
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(colWidths))
      } catch {
        /* ignore quota errors */
      }
    }
  }, [colWidths, storageKey])

  const measuredWidth = (id: string): number =>
    colWidthsRef.current[id] ??
    (thRefs.current[id]?.getBoundingClientRect().width || 160)

  const startColumnResize = (
    e: React.PointerEvent,
    col: DataTableColumn<T>
  ) => {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = {
      id: col.id,
      startX: e.clientX,
      startWidth: measuredWidth(col.id),
      min: col.minWidth ?? 80,
    }
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const next = Math.max(d.min, d.startWidth + (ev.clientX - d.startX))
      setColWidths((prev) => ({ ...prev, [d.id]: next }))
    }
    const onUp = () => {
      const d = dragRef.current
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.removeProperty('user-select')
      document.body.style.removeProperty('cursor')
      if (d) onColumnResize?.(d.id, colWidthsRef.current[d.id] ?? d.startWidth)
      dragRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    document.body.style.setProperty('user-select', 'none')
    document.body.style.setProperty('cursor', 'col-resize')
  }

  const onResizeKey = (e: React.KeyboardEvent, col: DataTableColumn<T>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const step = e.shiftKey ? 24 : 8
    const min = col.minWidth ?? 80
    const next = Math.max(
      min,
      measuredWidth(col.id) + (e.key === 'ArrowRight' ? step : -step)
    )
    setColWidths((prev) => ({ ...prev, [col.id]: next }))
    onColumnResize?.(col.id, next)
  }

  const query = globalFilter ?? internalQuery
  const isSelectionControlled = selectedIds !== undefined
  const selected = isSelectionControlled ? selectedIds! : internalSelected
  const colCount =
    columns.length + (selectable ? 1 : 0) + (renderExpanded ? 1 : 0)

  // Filter → sort
  const filtered = React.useMemo(() => {
    const match =
      filterFn ?? ((row: T, q: string) => defaultFilter(row, q, columns))
    return query ? data.filter((row) => match(row, query)) : data
  }, [data, query, filterFn, columns])

  const sorted = React.useMemo(() => {
    if (!sort) return filtered
    const col = columns.find((c) => c.id === sort.columnId)
    if (!col?.sortValue) return filtered
    const dir = sort.direction === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = col.sortValue!(a)
      const bv = col.sortValue!(b)
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [filtered, sort, columns])

  // Pagination
  const pageCount = pageSize
    ? Math.max(1, Math.ceil(sorted.length / pageSize))
    : 1
  const clampedPage = Math.min(page, pageCount)
  const paged = React.useMemo(() => {
    if (!pageSize) return sorted
    const startIdx = (clampedPage - 1) * pageSize
    return sorted.slice(startIdx, startIdx + pageSize)
  }, [sorted, pageSize, clampedPage])

  // Filtering or resizing the page invalidates the current page number. Done as
  // a render-time adjustment rather than an effect so the table never paints one
  // frame of an out-of-range page.
  const pageResetKey = `${query}\u0000${pageSize ?? ''}`
  const [prevPageResetKey, setPrevPageResetKey] = React.useState(pageResetKey)
  if (pageResetKey !== prevPageResetKey) {
    setPrevPageResetKey(pageResetKey)
    setPage(1)
  }

  // Virtualization over the current page's rows
  const canVirtualize = !!virtualize && !!maxBodyHeight && !renderExpanded
  const virtual = useVirtualRows<T>({
    rows: paged,
    rowHeight,
    containerRef: scrollRef,
    enabled: canVirtualize,
  })
  const visibleRows = canVirtualize ? virtual.visible : paged

  // Selection helpers (select-all applies to the full filtered set)
  const allIds = React.useMemo(() => sorted.map(getRowId), [sorted, getRowId])
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selected.includes(id))
  const someSelected = selected.length > 0 && !allSelected

  const setSelected = (ids: string[]) => {
    if (!isSelectionControlled) setInternalSelected(ids)
    onSelectionChange?.(ids)
  }
  const toggleAll = () => setSelected(allSelected ? [] : allIds)
  const toggleOne = (id: string) =>
    setSelected(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id]
    )

  const toggleSort = (col: DataTableColumn<T>) => {
    if (!col.sortValue) return
    setSort((prev) => {
      if (!prev || prev.columnId !== col.id)
        return { columnId: col.id, direction: 'asc' }
      if (prev.direction === 'asc')
        return { columnId: col.id, direction: 'desc' }
      return null
    })
  }

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const cellFor = (col: DataTableColumn<T>, row: T): React.ReactNode =>
    col.cell
      ? col.cell(row)
      : String((row as Record<string, unknown>)[col.id] ?? '')

  const selectedRows = React.useMemo(
    () => sorted.filter((r) => selected.includes(getRowId(r))),
    [sorted, selected, getRowId]
  )

  const ariaSortFor = (
    col: DataTableColumn<T>
  ): React.AriaAttributes['aria-sort'] => {
    if (!col.sortValue) return undefined
    if (sort?.columnId !== col.id) return 'none'
    return sort.direction === 'asc' ? 'ascending' : 'descending'
  }

  // ── Layout (plan §9.3) ───────────────────────────────────────────────────
  // A table becomes a list only where BOTH are true: a phone is reading it,
  // and this table declared how its row maps onto one. The tier is read here
  // and nowhere else in the component — everything below it is one branch or
  // the other, never a table styled to look like a list.
  const tier = useViewportTier()
  const layout: 'table' | 'list' =
    forceLayout ?? (mobileRow && tier === 'phone' ? 'list' : 'table')

  const columnById = React.useMemo(() => {
    const map = new Map<string, DataTableColumn<T>>()
    for (const col of columns) map.set(col.id, col)
    return map
  }, [columns])

  const sortableColumns = React.useMemo(
    () => columns.filter((c) => c.sortValue),
    [columns]
  )

  /** A column's rendered cell, prefixed by its header for screen readers. */
  const labelledCell = (
    columnId: string | undefined,
    row: T,
    withLabel: boolean
  ): React.ReactNode => {
    if (!columnId) return undefined
    const col = columnById.get(columnId)
    if (!col) return undefined
    const content = cellFor(col, row)
    if (!withLabel) return content
    // Out of a table, "3,500" alone says nothing about which number it is.
    // The column header is the label the table path gets from its <th>.
    return (
      <>
        <span className="sr-only">{col.header}: </span>
        {content}
      </>
    )
  }

  /**
   * The status line: one column, or several laid side by side.
   *
   * `ListRow` renders this into a `flex items-center gap-2` span, so the parts
   * space themselves and a missing column contributes nothing rather than an
   * empty gap.
   */
  const statusCell = (
    status: string | string[] | undefined,
    row: T
  ): React.ReactNode => {
    if (!status) return undefined
    if (typeof status === 'string') return labelledCell(status, row, false)
    const parts = status
      .map((columnId) => labelledCell(columnId, row, false))
      .filter((node): node is React.ReactNode => node !== undefined)
    if (parts.length === 0) return undefined
    return parts.map((node, i) => (
      <React.Fragment key={i}>{node}</React.Fragment>
    ))
  }

  /** `columnId` + direction, round-tripped through the compact sort Select. */
  const SORT_SEPARATOR = '\u0000'
  const sortValue = sort
    ? `${sort.columnId}${SORT_SEPARATOR}${sort.direction}`
    : ''

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {(searchable || (selectable && bulkActions)) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {searchable && globalFilter === undefined ? (
            <Input
              aria-label="Search"
              leftIcon={<Search />}
              placeholder={searchPlaceholder}
              value={internalQuery}
              onChange={(e) => setInternalQuery(e.target.value)}
              className="max-w-[220px]"
            />
          ) : (
            <span />
          )}
          {selectable && bulkActions && selected.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-mono-sm text-ink-muted tabular-nums">
                {selected.length} selected
              </span>
              {bulkActions(selectedRows)}
            </div>
          )}
        </div>
      )}

      {layout === 'list' && sortableColumns.length > 0 && (
        <Select
          aria-label="Sort"
          data-dense=""
          value={sortValue}
          onChange={(e) => {
            const [columnId, direction] = e.target.value.split(SORT_SEPARATOR)
            setSort(
              columnId
                ? { columnId, direction: direction as SortDirection }
                : null
            )
          }}
          className="phone:min-h-touch-sm"
        >
          {/* The table path sorts by tapping a column header; a list has no
              headers to tap, so the same state gets an explicit control. */}
          <option value="">Sort: default</option>
          {sortableColumns.flatMap((col) => [
            <option
              key={`${col.id}-asc`}
              value={`${col.id}${SORT_SEPARATOR}asc`}
            >
              {`Sort: ${col.header} ↑`}
            </option>,
            <option
              key={`${col.id}-desc`}
              value={`${col.id}${SORT_SEPARATOR}desc`}
            >
              {`Sort: ${col.header} ↓`}
            </option>,
          ])}
        </Select>
      )}

      {layout === 'list' ? (
        // Called, not rendered as <ListLayout />: a component declared inside
        // another component gets a new identity every render, so React would
        // unmount and rebuild the whole list on each keystroke — losing focus
        // in a row the user is interacting with.
        renderList()
      ) : (
        <TableContainer
          ref={scrollRef}
          style={
            maxBodyHeight
              ? { maxHeight: maxBodyHeight, overflowY: 'auto' }
              : undefined
          }
        >
          <Table className={cn(hasResizable && 'table-fixed')}>
            {caption && <caption className="sr-only">{caption}</caption>}
            {hasResizable && (
              <colgroup>
                {selectable && <col className="w-10" />}
                {renderExpanded && <col className="w-10" />}
                {columns.map((col) => (
                  <col
                    key={col.id}
                    style={{
                      width: colWidths[col.id]
                        ? `${colWidths[col.id]}px`
                        : col.width,
                    }}
                  />
                ))}
              </colgroup>
            )}
            <TableHeader
              className={cn(
                stickyHeader && 'sticky top-0 z-sticky bg-surface-card'
              )}
            >
              <TableRow>
                {selectable && (
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Select all rows"
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={toggleAll}
                    />
                  </TableHead>
                )}
                {renderExpanded && (
                  <TableHead className="w-10" aria-label="Expand" />
                )}
                {columns.map((col) => {
                  const active = sort?.columnId === col.id
                  return (
                    <TableHead
                      key={col.id}
                      ref={(el) => {
                        thRefs.current[col.id] = el
                      }}
                      numeric={col.numeric}
                      aria-sort={ariaSortFor(col)}
                      className={cn(
                        col.resizable && 'relative',
                        col.headerClassName
                      )}
                      style={
                        !hasResizable && col.width
                          ? { width: col.width }
                          : undefined
                      }
                    >
                      {col.sortValue ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(col)}
                          className={cn(
                            'group inline-flex items-center gap-1 rounded-sm text-metadata uppercase text-ink-muted transition-colors duration-fast hover:text-ink-secondary focus-visible:shadow-focus focus-visible:outline-none',
                            col.numeric && 'flex-row-reverse'
                          )}
                        >
                          {col.header}
                          {active ? (
                            sort!.direction === 'asc' ? (
                              <ChevronUp className="size-3" />
                            ) : (
                              <ChevronDown className="size-3" />
                            )
                          ) : (
                            <ChevronsUpDown className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                          )}
                        </button>
                      ) : (
                        col.header
                      )}
                      {col.resizable && (
                        <span
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={`Resize ${col.id} column`}
                          tabIndex={0}
                          onPointerDown={(e) => startColumnResize(e, col)}
                          onKeyDown={(e) => onResizeKey(e, col)}
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none bg-transparent transition-colors duration-fast hover:bg-line-2 focus-visible:bg-accentui focus-visible:outline-none"
                        />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            </TableHeader>

            <TableBody>
              {/* Loading */}
              {loading &&
                Array.from({ length: loadingRowCount }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    {selectable && (
                      <TableCell>
                        <Skeleton className="size-3.5" />
                      </TableCell>
                    )}
                    {renderExpanded && (
                      <TableCell>
                        <Skeleton className="size-3.5" />
                      </TableCell>
                    )}
                    {columns.map((col) => (
                      <TableCell key={col.id} numeric={col.numeric}>
                        <Skeleton className="h-3 w-full max-w-[120px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {/* Error */}
              {!loading && error && (
                <tr>
                  <td colSpan={colCount} className="p-4">
                    <Alert variant="error">{error}</Alert>
                  </td>
                </tr>
              )}

              {/* Empty */}
              {!loading && !error && sorted.length === 0 && (
                <tr>
                  <td colSpan={colCount}>
                    {/* A plain string is normalised into the EmptyState rather
                      than dropped raw into the cell. Passing one used to render
                      unpadded, left-aligned text that read as a second header
                      row — strictly worse than passing nothing, which is a trap
                      for an API whose prop is typed ReactNode. */}
                    {typeof empty === 'string' ? (
                      <EmptyState title={empty} />
                    ) : (
                      (empty ?? (
                        <EmptyState
                          title={query ? 'No results' : 'No data yet'}
                          description={
                            query ? `Nothing matches "${query}".` : undefined
                          }
                        />
                      ))
                    )}
                  </td>
                </tr>
              )}

              {/* Rows */}
              {!loading && !error && sorted.length > 0 && (
                <>
                  {canVirtualize && virtual.topPad > 0 && (
                    <tr aria-hidden="true">
                      <td
                        colSpan={colCount}
                        style={{
                          height: virtual.topPad,
                          padding: 0,
                          border: 0,
                        }}
                      />
                    </tr>
                  )}
                  {visibleRows.map((row) => {
                    const id = getRowId(row)
                    const isExpanded = expanded.has(id)
                    return (
                      <React.Fragment key={id}>
                        <TableRow
                          clickable={!!onRowClick}
                          selected={selected.includes(id)}
                          onClick={
                            onRowClick ? () => onRowClick(row) : undefined
                          }
                        >
                          {selectable && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                aria-label={`Select row ${id}`}
                                checked={selected.includes(id)}
                                onChange={() => toggleOne(id)}
                              />
                            </TableCell>
                          )}
                          {renderExpanded && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                aria-label={
                                  isExpanded ? 'Collapse row' : 'Expand row'
                                }
                                aria-expanded={isExpanded}
                                onClick={() => toggleExpand(id)}
                                className="rounded-sm p-0.5 text-ink-muted transition-colors duration-fast hover:text-ink focus-visible:shadow-focus focus-visible:outline-none"
                              >
                                <ChevronRight
                                  className={cn(
                                    'size-3.5 transition-transform',
                                    isExpanded && 'rotate-90'
                                  )}
                                />
                              </button>
                            </TableCell>
                          )}
                          {columns.map((col) => (
                            <TableCell
                              key={col.id}
                              numeric={col.numeric}
                              className={col.className}
                            >
                              {cellFor(col, row)}
                            </TableCell>
                          ))}
                        </TableRow>
                        {renderExpanded && isExpanded && (
                          <tr>
                            <td
                              colSpan={colCount}
                              className="border-b border-line-subtle bg-surface-base/40 p-4"
                            >
                              {renderExpanded(row)}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                  {canVirtualize && virtual.bottomPad > 0 && (
                    <tr aria-hidden="true">
                      <td
                        colSpan={colCount}
                        style={{
                          height: virtual.bottomPad,
                          padding: 0,
                          border: 0,
                        }}
                      />
                    </tr>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {pageSize && !loading && !error && pageCount > 1 && (
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-mono-sm text-ink-muted tabular-nums">
            {sorted.length} {sorted.length === 1 ? 'row' : 'rows'}
          </span>
          <Pagination
            page={clampedPage}
            pageCount={pageCount}
            onPageChange={setPage}
            responsive={layout === 'list'}
          />
        </div>
      )}
    </div>
  )

  /**
   * The phone path: the same rows, the same state, as `ListRow`s.
   *
   * Declared as a closure rather than a separate component so it reads
   * beside the table path it mirrors, and so the two cannot drift on which
   * `sorted`/`paged`/`selected` they use. Every state below is the table
   * path's state rendered for a list — a skeleton at row height, the same
   * `error` alert, the same `empty` normalisation.
   */
  function renderList() {
    if (loading) {
      return (
        <ul role="list" aria-label={caption} aria-busy="true">
          {Array.from({ length: loadingRowCount }).map((_, i) => (
            <li
              key={`sk-${i}`}
              className="flex min-h-touch flex-col justify-center gap-1 border-b border-line-subtle px-4 py-2"
            >
              <SkeletonText lines={2} />
            </li>
          ))}
        </ul>
      )
    }

    if (error) return <Alert variant="error">{error}</Alert>

    if (sorted.length === 0) {
      if (typeof empty === 'string') return <EmptyState title={empty} />
      return (
        empty ?? (
          <EmptyState
            title={query ? 'No results' : 'No data yet'}
            description={query ? `Nothing matches "${query}".` : undefined}
          />
        )
      )
    }

    return (
      <ul role="list" aria-label={caption}>
        {paged.map((row) => {
          const id = getRowId(row)
          const leading = mobileRow?.leading ? (
            mobileRow.leading(row)
          ) : selectable ? (
            // The bare checkbox is 24 px on a phone; the 44 px hit area
            // is this label's (§15.1 "label wraps the control").
            <label className="flex size-touch items-center justify-center">
              <Checkbox
                aria-label={`Select row ${id}`}
                checked={selected.includes(id)}
                onChange={() => toggleOne(id)}
              />
            </label>
          ) : undefined

          return (
            <ListRow
              key={id}
              leading={leading}
              primary={labelledCell(mobileRow?.primary, row, false)}
              status={statusCell(mobileRow?.status, row)}
              // Unlabelled, unlike `value`: a phone number and a plan name
              // say what they are, and an `sr-only` label would put an
              // ELEMENT inside the truncating meta line — which moves it from
              // the probe rule that permits an ellipsis to the one that
              // forbids clipping (see ListRow).
              meta={mobileRow?.meta
                ?.map((columnId) => labelledCell(columnId, row, false))
                .filter((node): node is React.ReactNode => node !== undefined)}
              value={labelledCell(mobileRow?.value, row, true)}
              actions={labelledCell(mobileRow?.actions, row, false)}
              selected={selected.includes(id)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            />
          )
        })}
      </ul>
    )
  }
}
