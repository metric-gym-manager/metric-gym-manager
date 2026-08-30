'use client'

import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Drawer — right-anchored side panel (spec §11 Drawer). Built on Radix Dialog
 * for focus trap, Escape, and ARIA. 420px on desktop; becomes a full-width
 * bottom sheet on touch/tablet (spec §9 Responsive). Structure: fixed 52px
 * header → scrollable body → fixed footer.
 *
 * `theme` sets an explicit light/dark scope on the portalled content.
 */
export interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  footer?: React.ReactNode
  theme?: 'light' | 'dark'
  className?: string
  children?: React.ReactNode
}

export function Drawer({
  open,
  onOpenChange,
  title,
  footer,
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
          aria-describedby={undefined}
          className={cn(
            'fixed inset-y-0 right-0 z-drawer flex w-[420px] max-w-full flex-col border-l border-line-2 bg-surface-card font-geist text-ink shadow-overlay animate-drawer-in focus:outline-none',
            'max-tablet:inset-x-0 max-tablet:bottom-0 max-tablet:top-auto max-tablet:h-[85vh] max-tablet:w-full max-tablet:rounded-t-sm max-tablet:border-l-0 max-tablet:border-t',
            className
          )}
        >
          <div className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-line-1 px-4">
            <Dialog.Title className="text-metadata uppercase text-ink-muted">
              {title ?? <span className="sr-only">Panel</span>}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="-mr-1 rounded-sm p-1 text-ink-muted transition-colors duration-fast hover:text-ink focus-visible:shadow-focus focus-visible:outline-none"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 text-body">
            {children}
          </div>

          {footer && (
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line-1 px-4 py-3">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
