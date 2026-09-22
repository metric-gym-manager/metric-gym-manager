'use client'

import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Drawer — right-anchored side panel (spec §11 Drawer). Built on Radix Dialog
 * for focus trap, Escape, and ARIA. 420px on desktop; becomes a full-width
 * bottom sheet on a phone (spec §9 Responsive; mobile rebuild plan §5.4).
 * Structure: fixed 52px header → scrollable body → fixed footer.
 *
 * `theme` sets an explicit light/dark scope on the portalled content.
 */
export interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  footer?: React.ReactNode
  /**
   * How tall the phone sheet is (plan §5.4). `full` (default) is today's
   * behaviour — a tall sheet. `auto` lets a short sheet be short: the More
   * navigation is eight rows, and a fixed 90 % sheet for eight rows is mostly
   * empty panel. Both are capped by the `sheet` token.
   *
   * Desktop is a side panel at either value.
   */
  size?: 'auto' | 'full'
  theme?: 'light' | 'dark'
  className?: string
  children?: React.ReactNode
}

export function Drawer({
  open,
  onOpenChange,
  title,
  footer,
  size = 'full',
  theme,
  className,
  children,
}: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-theme={theme}
          className="fixed inset-0 z-drawer-backdrop bg-surface-overlay"
        />
        <Dialog.Content
          data-theme={theme}
          data-size={size}
          aria-describedby={undefined}
          className={cn(
            'fixed inset-y-0 right-0 z-drawer flex w-[420px] max-w-full flex-col border-l border-line-2 bg-surface-card font-geist text-ink shadow-overlay animate-drawer-in focus:outline-none',
            // Bottom sheet on a phone. `max-tablet:` (767.98) was the same
            // boundary written a second way; `phone:` is the one the rebuild
            // uses everywhere (plan §4).
            'phone:inset-x-0 phone:inset-y-auto phone:bottom-0 phone:w-full phone:rounded-t-sm phone:border-l-0 phone:border-t',
            // `dvh`, not `vh`: a mobile browser's `vh` is the viewport with
            // the address bar hidden, so the old 85vh sheet was taller than
            // the visible screen while the bar was showing.
            size === 'full' ? 'phone:h-sheet' : 'phone:max-h-sheet',
            className
          )}
        >
          <div className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-line-1 px-4">
            <Dialog.Title className="text-metadata uppercase text-ink-muted">
              {title ?? <span className="sr-only">Panel</span>}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="-mr-1 rounded-sm p-1 text-ink-muted transition-colors duration-fast hover:text-ink focus-visible:shadow-focus focus-visible:outline-none phone:size-touch phone:p-0"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div
            className={cn(
              'min-h-0 flex-1 overflow-y-auto p-4 text-body',
              // Without a footer the body is the bottom edge, so it carries
              // the home-indicator inset itself.
              !footer && 'phone:pb-safe-bottom'
            )}
          >
            {children}
          </div>

          {footer && (
            <div className="shrink-0 border-t border-line-1 phone:pb-safe-bottom">
              <div className="flex items-center justify-end gap-2 px-4 py-3">
                {footer}
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
