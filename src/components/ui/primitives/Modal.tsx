'use client'

import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Modal — centered dialog for confirmations and forms (spec §11 Modal). Built on
 * Radix Dialog: focus trap, Escape-to-close, `role="dialog"` + `aria-modal`, and
 * scroll locking come for free (spec §8 Accessibility). Backdrop blurs; the
 * dialog animates in via the `palIn` keyframe. Reserved for destructive or
 * irreversible actions and forms (spec §1 Progressive disclosure).
 *
 * `theme` sets an explicit light/dark scope on the portalled content (portals
 * render at <body>, outside the surface's theme scope).
 */
export const modalContentVariants = cva(
  'fixed left-1/2 top-24 z-modal flex max-h-[calc(100vh-96px)] w-[480px] max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-line-2 bg-surface-card font-geist text-ink shadow-overlay animate-pal-in focus:outline-none',
  {
    variants: {
      size: {
        sm: 'w-[480px]',
        md: 'w-[560px]',
        lg: 'w-[720px]',
      },
    },
    defaultVariants: { size: 'sm' },
  }
)

export interface ModalProps extends VariantProps<typeof modalContentVariants> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  description?: React.ReactNode
  /** Red header treatment for destructive/irreversible actions. */
  destructive?: boolean
  /** Footer actions (right-aligned). */
  footer?: React.ReactNode
  /** Extra content shown on the left of the footer (e.g. secondary info). */
  footerStart?: React.ReactNode
  theme?: 'light' | 'dark'
  className?: string
  children?: React.ReactNode
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  destructive,
  size,
  footer,
  footerStart,
  theme,
  className,
  children,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-theme={theme}
          className="fixed inset-0 z-modal-backdrop bg-surface-overlay backdrop-blur-modal"
        />
        <Dialog.Content
          data-theme={theme}
          // Opt out of Radix's description warning only when we render none;
          // when a description exists Radix auto-wires aria-describedby to it.
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={cn(modalContentVariants({ size }), className)}
        >
          <div className="flex items-center justify-between gap-3 border-b border-line-1 px-4 py-3">
            <Dialog.Title
              className={cn(
                'text-metadata uppercase',
                destructive ? 'text-error' : 'text-ink-muted'
              )}
            >
              {title ?? <span className="sr-only">Dialog</span>}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="-mr-1 rounded-sm p-1 text-ink-muted transition-colors duration-fast hover:text-ink focus-visible:shadow-focus focus-visible:outline-none"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto p-4 text-body">
            {description && (
              <Dialog.Description className="text-body text-ink-secondary">
                {description}
              </Dialog.Description>
            )}
            {children}
          </div>

          {footer && (
            <div className="flex items-center justify-between gap-3 border-t border-line-1 px-4 py-3">
              <div className="min-w-0 text-caption text-ink-muted">
                {footerStart}
              </div>
              <div className="flex shrink-0 items-center gap-2">{footer}</div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
