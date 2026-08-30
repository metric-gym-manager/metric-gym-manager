'use client'

import * as React from 'react'
import { Modal, Button, FormField, Input } from '@/components/ui'

/**
 * DeleteDialog — destructive confirmation with type-to-confirm (Layer 3 composite;
 * spec §13 "Type-to-confirm" for destructive actions). The destructive button
 * stays disabled until the user types `confirmWord` exactly. Handles async
 * `onConfirm` with a loading state; resets the input each time it opens.
 */
export interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  description?: React.ReactNode
  onConfirm: () => void | Promise<void>
  confirmWord?: string
  confirmLabel?: string
  theme?: 'light' | 'dark'
  children?: React.ReactNode
}

export function DeleteDialog({
  open,
  onOpenChange,
  title = 'Delete',
  description,
  onConfirm,
  confirmWord = 'DELETE',
  confirmLabel = 'Delete',
  theme,
  children,
}: DeleteDialogProps) {
  const [text, setText] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const matches = text.trim() === confirmWord

  // Reset the confirmation field when the dialog opens. Adjusting state during
  // render (guarded by a previous-value compare) is React's documented
  // alternative to a reset effect: it applies before paint, so the stale word is
  // never briefly visible.
  const [prevOpen, setPrevOpen] = React.useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setText('')
  }

  const handleConfirm = async () => {
    if (!matches) return
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
      destructive
      theme={theme}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!matches}
            loading={submitting}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {description && (
          <p className="text-body text-ink-secondary">{description}</p>
        )}
        {children}
        <FormField
          label={
            <>
              Type{' '}
              <span className="font-mono normal-case tracking-normal text-ink">
                {confirmWord}
              </span>{' '}
              to confirm
            </>
          }
        >
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </FormField>
      </div>
    </Modal>
  )
}
