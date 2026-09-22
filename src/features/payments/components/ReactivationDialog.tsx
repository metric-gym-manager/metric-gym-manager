'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Modal, Button, Input, Label, Select } from '@/components/ui'
import { AlertCircle, Info, RotateCcw } from 'lucide-react'
import { calculateNextDueDate, formatDate } from '@/utils/date/date'
import type { MemberPlanType } from '@/features/members/schemas/member.schemas'

/**
 * Plan type row from the billing-setup plans endpoint.
 */
interface PlanTypeOption {
  id: string
  plan_type: MemberPlanType
  default_amount: number
  is_active: boolean
}

export interface ReactivationConfirm {
  planType: MemberPlanType
  planAmount: number
  paymentAmount: number
  paymentDate: string
}

interface ReactivationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberName: string
  /** Member's current plan type (pre-selected). */
  currentPlanType: MemberPlanType
  /** Member's current plan amount (pre-filled). */
  currentPlanAmount: number
  onConfirm: (values: ReactivationConfirm) => void
}

/**
 * Reactivation payment dialog.
 *
 * A "mark paid"-style dialog used to bring a cancelled or suspended member back
 * to active status. Unlike the plain mark-paid flow it lets the operator change
 * the plan type, the amount, and the payment date before recording the payment.
 */
export default function ReactivationDialog({
  open,
  onOpenChange,
  memberName,
  currentPlanType,
  currentPlanAmount,
  onConfirm,
}: ReactivationDialogProps) {
  const today = new Date().toISOString().split('T')[0]

  const [planType, setPlanType] = useState<MemberPlanType>(currentPlanType)
  const [planAmount, setPlanAmount] = useState<number>(currentPlanAmount)
  const [paymentAmount, setPaymentAmount] = useState<number>(currentPlanAmount)
  const [selectedDate, setSelectedDate] = useState(today)

  const { data: planTypesData } = useQuery({
    queryKey: ['billing-setup-plan-types'],
    queryFn: async () => {
      const response = await fetch('/api/billing-setup/plans')
      if (!response.ok) throw new Error('Failed to fetch plan types')
      const result = await response.json()
      return result.data as PlanTypeOption[]
    },
    enabled: open,
  })

  // Reset the form to the member's current plan each time the dialog (re)opens
  // (React "storing information from previous renders" pattern).
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setPlanType(currentPlanType)
      setPlanAmount(currentPlanAmount)
      setPaymentAmount(currentPlanAmount)
      setSelectedDate(today)
    }
  }

  const activePlans = (planTypesData ?? []).filter((p) => p.is_active)

  const handlePlanTypeChange = (nextPlanType: MemberPlanType) => {
    setPlanType(nextPlanType)
    // Auto-fill amounts from the selected plan's default price when available.
    const selected = activePlans.find((p) => p.plan_type === nextPlanType)
    if (selected && selected.default_amount > 0) {
      setPlanAmount(selected.default_amount)
      setPaymentAmount(selected.default_amount)
    }
  }

  const nextDueDate = calculateNextDueDate(selectedDate, planType)
  const isFutureDate = new Date(selectedDate) > new Date(today)
  const isValid = paymentAmount > 0 && planAmount > 0 && selectedDate !== ''

  const handleConfirm = () => {
    if (!isValid) return
    onConfirm({
      planType,
      planAmount,
      paymentAmount,
      paymentDate: selectedDate,
    })
  }

  const formatPlanLabel = (value: string) =>
    value.charAt(0).toUpperCase() + value.slice(1).replace('-', ' ')

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      // Four controls around a single decision — §11's sheet case, listed
      // there by name. Inert at >= 768.
      placement="sheet"
      title="Reactivate Membership"
      description="Choose the plan and payment details to bring this member back to active."
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={handleConfirm}
            disabled={!isValid}
          >
            <RotateCcw className="h-4 w-4" />
            Reactivate &amp; Record Payment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Member Info */}
        <div>
          <Label className="text-sm text-ink-muted">Reactivating</Label>
          <p className="text-lg font-semibold text-ink">{memberName}</p>
        </div>

        {/* Plan Type */}
        <div>
          <Label htmlFor="reactivate-plan-type" className="text-sm font-medium">
            Plan Type
          </Label>
          <Select
            id="reactivate-plan-type"
            value={planType}
            onChange={(e) =>
              handlePlanTypeChange(e.target.value as MemberPlanType)
            }
            className="mt-1"
          >
            {/* Fall back to the current plan when the plans list hasn't loaded
                yet so the select is never empty. */}
            {activePlans.length > 0 ? (
              activePlans.map((plan) => (
                <option key={plan.id} value={plan.plan_type}>
                  {formatPlanLabel(plan.plan_type)}
                  {plan.default_amount > 0 &&
                    ` (Rs. ${plan.default_amount.toLocaleString()})`}
                </option>
              ))
            ) : (
              <option value={currentPlanType}>
                {formatPlanLabel(currentPlanType)}
              </option>
            )}
          </Select>
        </div>

        {/* Plan Amount */}
        <div>
          <Label
            htmlFor="reactivate-plan-amount"
            className="text-sm font-medium"
          >
            Plan Amount (Rs.)
          </Label>
          <Input
            id="reactivate-plan-amount"
            type="number"
            min="0"
            step="0.01"
            value={planAmount || ''}
            onChange={(e) => setPlanAmount(Number(e.target.value))}
            className="mt-1"
          />
          <p className="mt-1 text-xs text-ink-muted">
            The recurring price saved on the member for future dues.
          </p>
        </div>

        {/* Payment Amount */}
        <div>
          <Label
            htmlFor="reactivate-payment-amount"
            className="text-sm font-medium"
          >
            Payment Amount (Rs.)
          </Label>
          <Input
            id="reactivate-payment-amount"
            type="number"
            min="0"
            step="0.01"
            value={paymentAmount || ''}
            onChange={(e) => setPaymentAmount(Number(e.target.value))}
            className="mt-1"
          />
          <p className="mt-1 text-xs text-ink-muted">
            The amount collected now to reactivate the membership.
          </p>
        </div>

        {/* Payment Date */}
        <div>
          <Label
            htmlFor="reactivate-payment-date"
            className="text-sm font-medium"
          >
            Payment Date
          </Label>
          <Input
            id="reactivate-payment-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="mt-1"
          />
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
