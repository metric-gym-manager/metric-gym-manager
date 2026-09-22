'use client'

import * as React from 'react'
import { Toaster as SonnerToaster, toast } from 'sonner'
import { useViewportTier } from '@/hooks/useViewportTier'
import { layout, spacing } from '../tokens'

/**
 * Toast — transient notifications, wrapping `sonner` (spec §11 Toast; §12
 * Optimistic UI). Imperative API:
 *
 * ```ts
 * import { toast } from '@/components/ui'
 * toast.success('Payment recorded')
 * toast.error('Could not send SMS')
 * ```
 *
 * Mount <Toaster /> once near the app root. It is design-token styled and
 * theme-aware (reads the nearest [data-theme] scope). Auto-dismiss defaults to
 * 5s per spec.
 */
export { toast }

export type ToasterProps = React.ComponentProps<typeof SonnerToaster>

/**
 * Where a toast sits on a phone (mobile rebuild plan §6.2, §25.1).
 *
 * Top-centre, cleared of the `AppBar` and of the notch — `h-bar` is the bar's
 * height, read from the token rather than retyped, and `--ds-safe-top` is the
 * inset. Sonner's own `mobileOffset` only applies below 600 px, so the same
 * values are passed as `offset` when the tier is a phone; our boundary is 768.
 */
const PHONE_OFFSET = {
  top: `calc(${layout.breadcrumbHeight} + var(--ds-safe-top) + ${spacing[2]})`,
  left: spacing[4],
  right: spacing[4],
  bottom: spacing[4],
}

export function Toaster(props: ToasterProps) {
  // Read directly, with no provider: the Toaster is mounted in the ROOT
  // layout, above the dashboard's `ViewportTierProvider`, and the hook
  // measures `matchMedia` whether or not a provider supplies a hint. Server
  // and hydration both answer `desktop`, so there is no mismatch; the
  // correction lands on the first client commit, with no toast on screen.
  const tier = useViewportTier()
  const phone = tier === 'phone'

  return (
    <SonnerToaster
      // Top-right leaves a phone toast hard against the edge under the
      // AppBar's own corner; centred, it reads as the page's own banner.
      position={phone ? 'top-center' : 'top-right'}
      offset={phone ? PHONE_OFFSET : undefined}
      mobileOffset={PHONE_OFFSET}
      duration={5000}
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            'rounded-sm border border-line-2 bg-surface-card font-geist text-body text-ink shadow-overlay',
          title: 'font-geist text-body font-medium text-ink',
          description: 'font-geist text-caption text-ink-muted',
          actionButton:
            'rounded-sm bg-solid px-2 py-1 text-button-sm text-solid-text',
          cancelButton:
            'rounded-sm border border-line-2 px-2 py-1 text-button-sm text-ink',
          success: 'text-success',
          warning: 'text-warning',
          error: 'text-error',
        },
      }}
      {...props}
    />
  )
}
