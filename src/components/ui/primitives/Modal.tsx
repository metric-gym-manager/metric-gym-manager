'use client'

import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ChevronLeft, X } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { useHistoryBack } from '@/hooks/useHistoryBack'
import { useViewportTier } from '@/hooks/useViewportTier'

/**
 * Modal — centered dialog for confirmations and forms (spec §11 Modal). Built on
 * Radix Dialog: focus trap, Escape-to-close, `role="dialog"` + `aria-modal`, and
 * scroll locking come for free (spec §8 Accessibility). Backdrop blurs; the
 * dialog animates in via the `palIn` keyframe. Reserved for destructive or
 * irreversible actions and forms (spec §1 Progressive disclosure).
 *
 * `theme` sets an explicit light/dark scope on the portalled content (portals
 * render at <body>, outside the surface's theme scope).
 *
 * `placement` (mobile rebuild plan §5.3) decides how the dialog meets a phone.
 * Every effect is `phone:`-scoped: at ≥ 768 all three placements render the
 * centred dialog this component has always rendered.
 */
export const modalContentVariants = cva(
  'fixed left-1/2 top-24 z-modal flex max-h-[calc(100vh-96px)] w-[480px] max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col overflow-hidden rounded-sm border border-line-2 bg-surface-card font-geist text-ink shadow-overlay animate-pal-in focus:outline-none',
  {
    variants: {
      size: {
        sm: 'w-[480px]',
        md: 'w-[560px]',
        lg: 'w-[720px]',
      },
      placement: {
        /** Today's dialog, at every width. */
        center: '',
        /**
         * Bottom sheet on a phone: anchored to the bottom edge, capped at the
         * `sheet` token, square against the screen edges it touches.
         */
        sheet:
          'phone:inset-x-0 phone:bottom-0 phone:top-auto phone:max-h-sheet phone:w-full phone:max-w-full phone:translate-x-0 phone:rounded-b-none phone:rounded-t-sm phone:border-x-0 phone:border-b-0',
        /**
         * A screen of its own on a phone. `dvh`, not `vh`: `vh` is the
         * viewport with the browser chrome hidden, so a `100vh` overlay is
         * taller than the visible screen while the address bar is showing and
         * its footer — the action bar — sits below the fold.
         */
        fullscreen:
          'phone:inset-0 phone:h-dvh phone:max-h-none phone:w-full phone:max-w-full phone:translate-x-0 phone:rounded-none phone:border-0',
      },
    },
    defaultVariants: { size: 'sm', placement: 'center' },
  }
)

export interface ModalProps extends Omit<
  VariantProps<typeof modalContentVariants>,
  'placement'
> {
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
  /**
   * How the dialog meets a **phone** (plan §5.3). `center` (default) is
   * today's behaviour everywhere. `sheet` anchors it to the bottom edge;
   * `fullscreen` gives it the whole screen, a leading Back control instead of
   * the trailing ×, a sticky action bar, and the hardware Back button.
   *
   * Desktop is unaffected by all three.
   */
  placement?: 'center' | 'sheet' | 'fullscreen'
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
  placement = 'center',
  theme,
  className,
  children,
}: ModalProps) {
  const tier = useViewportTier()
  const titleRef = React.useRef<HTMLHeadingElement>(null)

  // A fullscreen overlay is a screen, and Back dismisses a screen. Only on a
  // phone: at ≥ 768 this *is* the centred dialog, where claiming the browser's
  // Back button would be wrong. The tier hook is read for the behaviour
  // decision, never for sizing — that stays in CSS.
  const isPhoneFullscreen = placement === 'fullscreen' && tier === 'phone'
  useHistoryBack(open, () => onOpenChange(false), isPhoneFullscreen)

  const close = (
    <Dialog.Close
      aria-label="Close"
      className={cn(
        '-mr-1 rounded-sm p-1 text-ink-muted transition-colors duration-fast hover:text-ink focus-visible:shadow-focus focus-visible:outline-none',
        // Replaced by the leading Back control at phone width.
        placement === 'fullscreen' && 'phone:hidden'
      )}
    >
      <X className="size-4" />
    </Dialog.Close>
  )

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-theme={theme}
          className="fixed inset-0 z-modal-backdrop bg-surface-overlay"
        />
        <Dialog.Content
          data-theme={theme}
          data-placement={placement}
          // Opt out of Radix's description warning only when we render none;
          // when a description exists Radix auto-wires aria-describedby to it.
          {...(description ? {} : { 'aria-describedby': undefined })}
          onOpenAutoFocus={
            isPhoneFullscreen
              ? (event) => {
                  // §15.2: a fullscreen overlay puts focus on its title, so a
                  // screen reader announces what the new screen is instead of
                  // the first control on it.
                  event.preventDefault()
                  titleRef.current?.focus()
                }
              : undefined
          }
          className={cn(modalContentVariants({ size, placement }), className)}
        >
          <div className="flex items-center justify-between gap-3 border-b border-line-1 px-4 py-3">
            {placement === 'fullscreen' && (
              <Dialog.Close
                aria-label="Back"
                // Hidden at ≥ 768, where the × above is the close control.
                // Both are rendered and one is `display: none`, so the header
                // needs no tier switch and cannot mismatch on hydration.
                className="-ml-2 hidden size-touch shrink-0 items-center justify-center rounded-sm text-ink-muted transition-colors duration-fast hover:text-ink focus-visible:shadow-focus focus-visible:outline-none phone:inline-flex"
              >
                <ChevronLeft className="size-4" />
              </Dialog.Close>
            )}
            <Dialog.Title
              ref={titleRef}
              tabIndex={isPhoneFullscreen ? -1 : undefined}
              className={cn(
                'text-metadata uppercase focus:outline-none',
                destructive ? 'text-error' : 'text-ink-muted',
                placement === 'fullscreen' &&
                  'phone:min-w-0 phone:flex-1 phone:truncate'
              )}
            >
              {title ?? <span className="sr-only">Dialog</span>}
            </Dialog.Title>
            {close}
          </div>

          <div
            className={cn(
              'overflow-y-auto p-4 text-body',
              // The scroller has to be allowed to shrink inside the flex
              // column, or a fixed-height overlay pushes its footer off the
              // bottom instead of scrolling its body.
              placement !== 'center' && 'phone:min-h-0 phone:flex-1'
            )}
          >
            {description && (
              <Dialog.Description className="text-body text-ink-secondary">
                {description}
              </Dialog.Description>
            )}
            {children}
          </div>

          {footer && (
            <div
              // The border lives on this wrapper so the safe-area inset can be
              // added below the action row without doubling its padding.
              className={cn(
                'shrink-0 border-t border-line-1',
                placement !== 'center' && 'phone:pb-safe-bottom'
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-between gap-3 px-4 py-3',
                  placement === 'fullscreen' &&
                    'phone:flex-col phone:items-stretch phone:gap-2'
                )}
              >
                <div className="min-w-0 text-caption text-ink-muted">
                  {footerStart}
                </div>
                <div
                  className={cn(
                    'flex shrink-0 items-center gap-2',
                    // The action bar: full width, buttons sharing it, so both
                    // stay reachable with one thumb at 320 px.
                    placement === 'fullscreen' &&
                      'phone:w-full phone:[&>*]:flex-1'
                  )}
                >
                  {footer}
                </div>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
