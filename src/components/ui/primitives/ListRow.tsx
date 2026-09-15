'use client'

import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * ListRow — one record, as a row (mobile rebuild plan §9.1).
 *
 * ```
 * ┌ leading ┐ primary ─────────────────────────── trailing value ┐
 * │ avatar/ │ Nimal Perera                              3,500     │
 * │ checkbox│ ● EXPIRED · 12 DAYS AGO   (status line)             │
 * │         │ +94 77 123 4567 · Monthly (secondary meta)          │
 * │         │ [ Record payment ] [ Remind ]  (actions, optional)  │
 * └─────────┴─────────────────────────────────────────────────────┘
 * ```
 *
 * **Not a Card and not a table row.** A Card is a container for an
 * independent object with its own border and radius; a table row belongs to a
 * grid of columns. This is a hairline-separated line item in a list of many —
 * no radius, no background, no shadow — and it is the phone presentation of
 * every list in the product (§9.2). `DataTable` builds these from the same
 * `columns` the table path uses, so a screen never hand-writes one.
 *
 * **The target is the row's primary column, and it is a real 44 px target.**
 * The button carries the primary text *and* the status and meta lines so its
 * box is the full column; `aria-labelledby` keeps the accessible name to the
 * primary text alone and `aria-describedby` attaches the rest as description
 * (§9.1). Naming it by its whole content would read "Nimal Perera expired 12
 * days ago +94 77 123 4567 monthly" as one string.
 *
 * **The value wraps instead of colliding.** §9.1 asks for the value to drop
 * under the primary text "when the row is narrower than 340 px". That is
 * expressed here as flex wrapping rather than a breakpoint: the primary
 * column claims `basis-40` (160 px) and the value `min-w-24` (96), so with the
 * 12 px gap the two sit side by side only once the row can hold 268 px of
 * content — which, after `px-4` and a leading avatar, is a row of about 338 px.
 * The result is content-aware — a row with a leading avatar wraps sooner than
 * one without, which a viewport breakpoint cannot express — and needs no new
 * token. (`basis-40` is Tailwind's spacing 40 = 10rem, not the `touch-sm`
 * token; they are unrelated numbers that happen to read alike.)
 */
export interface ListRowProps {
  /** The record's name. Required; clamped to two lines. */
  primary: React.ReactNode
  /** Avatar, selection checkbox, or icon. */
  leading?: React.ReactNode
  /** Status line — typically a `Badge` plus a mono date. */
  status?: React.ReactNode
  /** Secondary meta segments, joined with " · " and truncated to one line. */
  meta?: React.ReactNode[]
  /** Trailing figure. Mono and tabular so a column of them aligns. */
  value?: React.ReactNode
  /** One or two dense buttons. Three or more belong in a `DropdownMenu`. */
  actions?: React.ReactNode
  /** Navigate on tap. */
  href?: string
  /**
   * Act on tap. Alone it makes the row a `<button>`; alongside `href` it runs
   * on the link's click, which is how the More sheet drops its own history
   * entry before letting the navigation proceed.
   */
  onClick?: (event: React.MouseEvent<HTMLElement>) => void
  /** Persistent selection (§25.1, ruling R7): a `surface-selected` fill. */
  selected?: boolean
  className?: string
}

export function ListRow({
  primary,
  leading,
  status,
  meta,
  value,
  actions,
  href,
  onClick,
  selected,
  className,
}: ListRowProps) {
  const id = React.useId()
  const primaryId = `${id}-primary`
  const descriptionId = `${id}-description`

  const hasDescription = Boolean(status) || Boolean(meta?.length)
  const interactive = Boolean(href || onClick)

  /**
   * The meta line, as ONE text node wherever the segments allow it.
   *
   * Not cosmetic. The probe has two rules for a container narrower than its
   * content: rule 3 forbids clipping, and rule 9 permits it when the element
   * holds nothing but text and truncates with an ellipsis — which is exactly
   * what this line does. `hasOnlyText` requires *every* child to be a text
   * node, and React separates adjacent text children with `<!-- -->` comment
   * nodes, so even a text separator left the line failing rule 3 on every row
   * in the product. Joining to a single string is what actually fixes it.
   *
   * Found by running the probe over the showcase in a browser. jsdom renders
   * no comment separators and computes no widths, so no unit test could have
   * seen it.
   */
  /**
   * True when the meta line is one joined string, false when the caller
   * passed an element (a `tel:` link, a `Badge`). It decides whether the line
   * TRUNCATES or WRAPS — see the class below.
   */
  const metaIsPlainText = React.useMemo(
    () =>
      (meta ?? [])
        .filter((s) => s !== null && s !== undefined && s !== '')
        .every((s) => typeof s === 'string' || typeof s === 'number'),
    [meta]
  )

  const metaContent = React.useMemo((): React.ReactNode => {
    if (!meta || meta.length === 0) return null
    const plain = meta.filter(
      (segment) => segment !== null && segment !== undefined && segment !== ''
    )
    if (plain.length === 0) return null
    if (plain.every((s) => typeof s === 'string' || typeof s === 'number')) {
      return plain.join(' · ')
    }
    // A segment that is an element (a Badge, a link) cannot be joined. The
    // caller has chosen a richer line and owns its truncation.
    return plain.map((segment, i) => (
      <React.Fragment key={i}>
        {i > 0 ? ' · ' : ''}
        {segment}
      </React.Fragment>
    ))
  }, [meta])

  const body = (
    <>
      <span id={primaryId} className="line-clamp-2 text-body text-ink">
        {primary}
      </span>
      {hasDescription && (
        <span id={descriptionId} className="contents">
          {status && (
            <span className="flex items-center gap-2 text-caption text-ink-secondary">
              {status}
            </span>
          )}
          {metaContent !== null && (
            <span
              className={cn(
                'font-mono text-mono-sm text-ink-muted',
                /*
                 * Truncate a line of TEXT; wrap a line with an element in it.
                 *
                 * The probe permits an ellipsis only where the element holds
                 * nothing but text (rule 9); anything else that overflows is
                 * rule 3, a clip. A caller that puts a link or a badge here
                 * therefore cannot have an ellipsis at all — so the honest
                 * answer is a second line rather than a silent cut.
                 *
                 * Found at 390 and nowhere else: at 320 and 360 the value
                 * WRAPS below the primary column and hands this line the full
                 * row; at 430 there is room for both. 390 is the width where
                 * the value sits alongside and the line is squeezed to 174 px.
                 */
                metaIsPlainText ? 'truncate' : 'break-words'
              )}
            >
              {metaContent}
            </span>
          )}
        </span>
      )}
    </>
  )

  const targetClassName = cn(
    'flex min-h-touch min-w-0 flex-1 basis-40 flex-col justify-center gap-0.5 py-2 text-left',
    interactive &&
      'rounded-sm focus-visible:shadow-focus focus-visible:outline-none active:bg-surface-active'
  )

  const target = href ? (
    <Link
      href={href}
      onClick={onClick}
      aria-labelledby={primaryId}
      aria-describedby={hasDescription ? descriptionId : undefined}
      className={targetClassName}
    >
      {body}
    </Link>
  ) : onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-labelledby={primaryId}
      aria-describedby={hasDescription ? descriptionId : undefined}
      className={targetClassName}
    >
      {body}
    </button>
  ) : (
    <div className={targetClassName}>{body}</div>
  )

  return (
    <li
      data-selected={selected ? '' : undefined}
      className={cn(
        'border-b border-line-subtle',
        selected && 'bg-surface-selected',
        className
      )}
    >
      <div className="flex min-h-touch items-center gap-3 px-4">
        {leading && <span className="shrink-0">{leading}</span>}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3">
          {target}
          {value !== undefined && value !== null && (
            <span className="ml-auto min-w-24 shrink-0 whitespace-nowrap py-2 text-right font-mono text-body text-ink tabular-nums">
              {value}
            </span>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 px-4 pb-2">
          {actions}
        </div>
      )}
    </li>
  )
}
