'use client'

import * as React from 'react'
import { Toaster as SonnerToaster, toast } from 'sonner'

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

export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      position="top-right"
      duration={5000}
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            'rounded-lg border border-line-2 bg-surface-card font-geist text-body text-ink shadow-overlay',
          title: 'font-geist text-body font-medium text-ink',
          description: 'font-geist text-caption text-ink-muted',
          actionButton:
            'rounded-md bg-solid px-2 py-1 text-button-sm text-solid-text',
          cancelButton:
            'rounded-md border border-line-2 px-2 py-1 text-button-sm text-ink',
          success: 'text-success',
          warning: 'text-warning',
          error: 'text-error',
        },
      }}
      {...props}
    />
  )
}
