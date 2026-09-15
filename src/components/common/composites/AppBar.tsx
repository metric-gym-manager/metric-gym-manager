'use client'

import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui'

/**
 * AppBar — the phone chrome at the top of a workspace screen (mobile rebuild
 * plan §5.11, §25.2).
 *
 * Not a `PageHeader`, which is an in-flow heading that scrolls with the
 * content, and not `WorkspaceHeader`, which is the desktop breadcrumb bar.
 * This is a sticky 52 px bar with a leading control, a centred title, and
 * nothing else.
 *
 * **It carries no action slot, deliberately** (plan correction C7). A page's
 * primary action stays in the page's own first content row; routing it up
 * into shared chrome means every page pushing its buttons through context,
 * and every screen's header quietly becoming a different shape.
 *
 * The trailing cell is rendered empty at the same width as the leading one so
 * the title is centred against the screen rather than against whatever the
 * leading control happens to be.
 */
export interface AppBarProps {
  /** Section name — `crumbForPath(pathname)` on a root page. */
  title: string
  /**
   * Root pages: the gym identity, as a 44 px button that opens the More
   * sheet. Ignored when `onBack` is given — a nested screen leads with Back.
   */
  identity?: {
    name: string
    imageUrl?: string
    /** Opens the More sheet. */
    onOpen: () => void
    /** Whether the More sheet is currently open. */
    expanded?: boolean
  }
  /** Nested pages: go up one level. */
  onBack?: () => void
  className?: string
}

export function AppBar({ title, identity, onBack, className }: AppBarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-sticky border-b border-line-1 bg-surface-panel pt-safe-top',
        // Landscape on a notched phone insets the sides too; only the bars
        // need it, because only the bars run edge to edge.
        'pl-safe-left pr-safe-right',
        className
      )}
    >
      <div className="grid h-bar grid-cols-[theme(spacing.touch)_1fr_theme(spacing.touch)] items-center px-4">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="-ml-2 flex size-touch items-center justify-center rounded-sm text-ink-secondary transition-colors duration-fast hover:text-ink focus-visible:shadow-focus focus-visible:outline-none active:bg-surface-active"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
        ) : identity ? (
          <button
            type="button"
            onClick={identity.onOpen}
            aria-label={`${identity.name} — open navigation`}
            aria-expanded={identity.expanded ?? false}
            className="-ml-2 flex size-touch items-center justify-center rounded-sm focus-visible:shadow-focus focus-visible:outline-none active:bg-surface-active"
          >
            <Avatar size="sm" name={identity.name} src={identity.imageUrl} />
          </button>
        ) : (
          <span />
        )}

        <h1 className="truncate text-center text-h2 text-ink">{title}</h1>

        {/* Reserved, never filled — see the note above about C7. */}
        <span aria-hidden="true" />
      </div>
    </header>
  )
}
