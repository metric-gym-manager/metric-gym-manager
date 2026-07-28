import { useState } from 'react'
import { Modal, Button } from '@/components/ui'

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

  const destructive = state.variant === 'destructive'

  const ConfirmDialog = () => (
    <Modal
      open={state.isOpen}
      onOpenChange={(open) => {
        if (!open) handleCancel()
      }}
      title={state.title}
      description={state.description}
      destructive={destructive}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleCancel}>
            {state.cancelText}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'accent'}
            onClick={handleConfirm}
          >
            {state.confirmText}
          </Button>
        </>
      }
    />
  )

  return { confirm, ConfirmDialog }
}
