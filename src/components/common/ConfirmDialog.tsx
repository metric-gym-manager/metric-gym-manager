import { Modal, Button } from '@/components/ui'

/**
 * Props for the ConfirmDialog component
 */
export interface ConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback to change the open state */
  onOpenChange: (open: boolean) => void
  /** Dialog title */
  title: string
  /** Dialog description/message */
  description: string
  /** Text for the confirm button (default: "Confirm") */
  confirmText?: string
  /** Text for the cancel button (default: "Cancel") */
  cancelText?: string
  /** Callback when confirm button is clicked */
  onConfirm: () => void
  /** Visual variant for the confirm button (default: "default") */
  variant?: 'default' | 'destructive'
}

/**
 * Reusable confirmation dialog component.
 * Displays a confirmation prompt with customizable title, description, and button text.
 * Supports both default and destructive variants for different use cases.
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * <ConfirmDialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   title="Confirm Payment"
 *   description="Record Rs. 5,000 payment for John Doe?"
 *   confirmText="Mark Paid"
 *   onConfirm={() => handlePayment()}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Destructive variant for delete actions
 * <ConfirmDialog
 *   open={deleteDialogOpen}
 *   onOpenChange={setDeleteDialogOpen}
 *   title="Delete Member"
 *   description="This action cannot be undone. Are you sure?"
 *   confirmText="Yes, Delete"
 *   variant="destructive"
 *   onConfirm={() => handleDelete()}
 * />
 * ```
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  variant = 'default',
}: ConfirmDialogProps) {
  const destructive = variant === 'destructive'
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      destructive={destructive}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'accent'}
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmText}
          </Button>
        </>
      }
    />
  )
}
