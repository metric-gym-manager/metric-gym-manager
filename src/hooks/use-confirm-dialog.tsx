import { useState } from 'react'
import { ConfirmDialog as ConfirmDialogComposite } from '@/components/common/composites'

interface ConfirmOptions {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}

interface ConfirmDialogState extends ConfirmOptions {
  isOpen: boolean
  resolve?: (value: boolean) => void
}

/**
 * Imperative confirmation prompt: `await confirm({ ... })` resolves to the
 * user's choice. Renders the Metric `ConfirmDialog` composite (Layer 3) — the
 * single confirm-dialog implementation — so the imperative and declarative
 * entry points share one UI.
 */
export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'default',
  })

  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        ...options,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'default',
        resolve,
      })
    })
  }

  const handleConfirm = () => {
    state.resolve?.(true)
    setState((prev) => ({ ...prev, isOpen: false }))
  }

  const handleCancel = () => {
    state.resolve?.(false)
    setState((prev) => ({ ...prev, isOpen: false }))
  }

  const ConfirmDialog = () => (
    <ConfirmDialogComposite
      open={state.isOpen}
      onOpenChange={(open) => {
        if (!open) handleCancel()
      }}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmText}
      cancelLabel={state.cancelText}
      destructive={state.variant === 'destructive'}
      onConfirm={handleConfirm}
    />
  )

  return { confirm, ConfirmDialog }
}
