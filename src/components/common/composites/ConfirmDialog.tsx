'use client'

import * as React from 'react'
import { Modal, Button } from '@/components/ui'

/**
 * ConfirmDialog — a Modal preset for confirming an action (Layer 3 composite;
 * spec §1 modals reserved for destructive/irreversible actions, §14 Destructive
 * Confirmation). Handles async `onConfirm` with an internal loading state and
 * closes on success. Use `DeleteDialog` for type-to-confirm deletions.
 */
export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  destructive?: boolean
  theme?: 'light' | 'dark'
  children?: React.ReactNode
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  destructive,
  theme,
  children,
}: ConfirmDialogProps) {
  const [submitting, setSubmitting] = React.useState(false)

  const handleConfirm = async () => {
    try {
      setSubmitting(true)
      await onConfirm()
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      destructive={destructive}
      theme={theme}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'accent'}
            loading={submitting}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  )
}
