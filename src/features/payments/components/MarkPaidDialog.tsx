'use client'

import { useState } from 'react'
import { Modal, Button, Input, Label } from '@/components/ui'
import { AlertCircle, Info } from 'lucide-react'
import { calculateNextDueDate, formatDate } from '@/utils/date/date'

interface MarkPaidDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberName: string
  amount: number
  planType: string
  onConfirm: (paymentDate: string) => void
}

export default function MarkPaidDialog({
  open,
  onOpenChange,
  memberName,
  amount,
  planType,
  onConfirm,
}: MarkPaidDialogProps) {
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)

  // Reset to today when the dialog (re)opens — render-time adjustment
  // (React "storing information from previous renders" pattern)
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setSelectedDate(today)
    }
  }

  const nextDueDate = calculateNextDueDate(selectedDate, planType)
  const isFutureDate = new Date(selectedDate) > new Date(today)

  const handleConfirm = () => {
    onConfirm(selectedDate)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      // A date and a confirm — one decision, so §11 puts it on the bottom
      // edge on a phone. Inert at >= 768, where this stays the centred dialog
      // it has always been. Its only caller is `MemberDetailModal`.
      placement="sheet"
      title="Confirm Payment"
      description="Review payment details and confirm to record the payment."
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" variant="accent" onClick={handleConfirm}>
            Confirm Payment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Member Info */}
        <div>
          <Label className="text-sm text-ink-muted">Record payment for</Label>
          <p className="text-lg font-semibold text-ink">{memberName}</p>
        </div>

        {/* Amount */}
        <div>
          <Label className="text-sm text-ink-muted">Amount</Label>
          <p className="text-lg font-semibold text-ink">
            Rs.{' '}
            {amount.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        {/* Payment Date Picker */}
        <div>
          <Label htmlFor="payment-date" className="text-sm font-medium">
            Payment Date
          </Label>
          <Input
            id="payment-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="mt-1"
          />
          <p className="mt-1 text-xs text-ink-muted">
            Choose the date when this payment was made
          </p>
        </div>

        {/* Future Date Warning */}
        {isFutureDate && (
          <div className="flex items-start gap-2 rounded-sm bg-warning-bg border border-warning-border p-3">
            <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-warning">
                Future Date Selected
              </p>
              <p className="text-xs text-warning mt-0.5">
                The payment date is in the future. Please confirm this is
                intentional.
              </p>
            </div>
          </div>
        )}

        {/* Next Due Date Preview */}
        <div className="flex items-start gap-2 rounded-sm bg-accentui-bg border border-accentui-border p-3">
          <Info className="h-4 w-4 text-brand-link mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-brand-link">Next Due Date</p>
            <p className="text-xs text-brand-link mt-0.5">
              Member&apos;s next payment will be due on{' '}
              {formatDate(nextDueDate)}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  )
}
