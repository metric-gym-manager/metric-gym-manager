'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Modal,
  Button,
  Input,
  Label,
  Select,
  Checkbox,
  Badge,
} from '@/components/ui'
import {
  collectPaymentSchema,
  type CollectPaymentInput,
} from '@/features/members/schemas/member.schemas'
import type { OverdueMember } from '@/features/members/types'

interface PaymentCollectionModalProps {
  open: boolean
  onClose: () => void
  member: OverdueMember | null
}

export default function PaymentCollectionModal({
  open,
  onClose,
  member,
}: PaymentCollectionModalProps) {
  const queryClient = useQueryClient()
  const [planAmount, setPlanAmount] = useState<number>(0)
  const [discountPercentage, setDiscountPercentage] = useState<number>(0)
  const [paymentAmount, setPaymentAmount] = useState<number>(0)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<Omit<CollectPaymentInput, 'memberId'>>({
    resolver: zodResolver(collectPaymentSchema.omit({ memberId: true })),
    defaultValues: {
      paymentDate: new Date().toISOString().split('T')[0],
      deductOverduePeriod: false,
    },
  })

  // Watch form values
  const watchPlanAmount = watch('planAmount')
  const watchDiscountId = watch('discountId')

  // Initialize form when member changes
  useEffect(() => {
    if (member) {
      setPlanAmount(member.plan_amount)
      setValue('planAmount', member.plan_amount)

      // Pre-select discount if recurring
      if (member.recurring_discount && member.discount_id) {
        setValue('discountId', member.discount_id)
        // TODO: Fetch actual discount percentage
        setDiscountPercentage(member.discount?.discount_percentage || 0)
      } else {
        setValue('discountId', null)
        setDiscountPercentage(0)
      }
    }
  }, [member, setValue])

  // Calculate payment amount
  useEffect(() => {
    if (watchPlanAmount) {
      const amount = watchPlanAmount
      const discount = discountPercentage
      const finalAmount = amount - (amount * discount) / 100
      setPaymentAmount(finalAmount)
      setValue('paymentAmount', finalAmount)
    }
  }, [watchPlanAmount, discountPercentage, setValue])

  // Collect payment mutation with optimistic update rollback pattern
  const collectPaymentMutation = useMutation({
    mutationFn: async (data: CollectPaymentInput) => {
      const response = await fetch(`/api/members/${data.memberId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to collect payment')
      }

      return response.json()
    },
    onMutate: async (_variables) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['members'] })
      await queryClient.cancelQueries({ queryKey: ['regular-payments'] })
      await queryClient.cancelQueries({ queryKey: ['sms-reminders'] })

      // Snapshot previous query data for rollback
      const previousMembers = queryClient.getQueriesData({
        queryKey: ['members'],
      })
      const previousRegularPayments = queryClient.getQueriesData({
        queryKey: ['regular-payments'],
      })
      const previousSmsReminders = queryClient.getQueriesData({
        queryKey: ['sms-reminders'],
      })

      // Return context object with snapshots for rollback
      return {
        previousMembers,
        previousRegularPayments,
        previousSmsReminders,
      }
    },
    onError: (error, _variables, context) => {
      // Rollback to previous state if mutation fails
      if (context) {
        // Restore all snapshotted query data
        context.previousMembers.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
        context.previousRegularPayments.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
        context.previousSmsReminders.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }

      // Show error toast
      toast.error(
        error instanceof Error ? error.message : 'Failed to collect payment'
      )
    },
    onSuccess: () => {
      toast.success('Payment collected — receipt SMS sent')
      reset()
      onClose()
      // Batch invalidations to refetch fresh data
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === 'members' ||
          query.queryKey[0] === 'regular-payments' ||
          query.queryKey[0] === 'sms-reminders',
      })
    },
  })

  const onSubmit = (data: Omit<CollectPaymentInput, 'memberId'>) => {
    if (!member) return

    collectPaymentMutation.mutate({
      ...data,
      memberId: member.id,
    })
  }

  // Fetch next due date preview from API
  const paymentDate = watch('paymentDate')
  const deductOverduePeriod = watch('deductOverduePeriod')

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!member || !paymentDate) return null

      const response = await fetch(
        `/api/members/${member.id}/payment/preview`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentDate,
            deductOverduePeriod: deductOverduePeriod ?? false,
          }),
        }
      )

      if (!response.ok) return null

      const result = await response.json()
      return result.data
    },
  })

  const { mutate: fetchPreview } = previewMutation

  // Trigger preview calculation when relevant fields change
  useEffect(() => {
    if (member && paymentDate) {
      fetchPreview()
    }
  }, [member, paymentDate, deductOverduePeriod, fetchPreview])

  const nextDueDatePreview =
    previewMutation.data?.nextDueDateFormatted || 'Calculating...'

  if (!member) return null

  // Format currency
  const formatCurrency = (amount: number) => {
    return `LKR ${amount.toFixed(2)}`
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      size="lg"
      title="Collect Payment"
      description="Record payment for overdue member"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              reset()
              onClose()
            }}
            disabled={collectPaymentMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="collect-payment-form"
            variant="accent"
            loading={collectPaymentMutation.isPending}
            disabled={collectPaymentMutation.isPending}
          >
            {collectPaymentMutation.isPending
              ? 'Processing...'
              : 'Collect Payment'}
          </Button>
        </>
      }
    >
      <form
        id="collect-payment-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6"
      >
        {/* Member Information */}
        <div className="rounded-lg border border-line-1 bg-surface-input p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-ink-muted">Member Name</Label>
              <p className="text-base font-semibold">{member.name}</p>
            </div>
            <Badge variant="error">Overdue by {member.days_overdue} days</Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-ink-muted">Phone Number</Label>
              <p className="text-sm font-medium">{member.phone_number}</p>
            </div>

            <div>
              <Label className="text-sm text-ink-muted">Plan Type</Label>
              <p className="text-sm font-medium capitalize">
                {member.plan_type}
              </p>
            </div>

            <div>
              <Label className="text-sm text-ink-muted">
                Original Due Date
              </Label>
              <p className="text-sm font-medium">
                {new Date(member.next_due_date).toLocaleDateString('en-GB')}
              </p>
            </div>

            <div>
              <Label className="text-sm text-ink-muted">Status</Label>
              <Badge variant="neutral">{member.status}</Badge>
            </div>
          </div>
        </div>

        {/* Payment Details */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Payment Details</h3>

          <div>
            <Label htmlFor="paymentDate">Payment Date *</Label>
            <Input id="paymentDate" type="date" {...register('paymentDate')} />
            {errors.paymentDate && (
              <p className="text-sm text-error mt-1">
                {errors.paymentDate.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="planAmount">Plan Amount (LKR) *</Label>
            <Input
              id="planAmount"
              type="number"
              {...register('planAmount', { valueAsNumber: true })}
              placeholder="Enter plan amount"
            />
            {errors.planAmount && (
              <p className="text-sm text-error mt-1">
                {errors.planAmount.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="payment-modal-discount-select">Discount</Label>
            <Select
              id="payment-modal-discount-select"
              value={watchDiscountId || 'none'}
              onChange={(e) => {
                const value = e.target.value
                if (value === 'none') {
                  setValue('discountId', null)
                  setDiscountPercentage(0)
                } else {
                  setValue('discountId', value)
                  // TODO: Fetch discount percentage from API
                  // For now, use member's existing discount or hardcoded values
                  if (member.discount && value === member.discount_id) {
                    setDiscountPercentage(member.discount.discount_percentage)
                  } else {
                    if (value === 'student') setDiscountPercentage(10)
                    else if (value === 'senior') setDiscountPercentage(15)
                    else if (value === 'family') setDiscountPercentage(20)
                  }
                }
              }}
            >
              <option value="none">No Discount</option>
              {member.discount && (
                <option value={member.discount_id || ''}>
                  {member.discount.discount_name} (
                  {member.discount.discount_percentage}%)
                </option>
              )}
              <option value="student">Student Discount (10%)</option>
              <option value="senior">Senior Discount (15%)</option>
              <option value="family">Family Discount (20%)</option>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="deductOverduePeriod"
              checked={!!watch('deductOverduePeriod')}
              onChange={(e) =>
                setValue('deductOverduePeriod', e.target.checked)
              }
            />
            <Label
              htmlFor="deductOverduePeriod"
              className="text-sm font-normal"
            >
              Deduct overdue period (start new cycle from payment date)
            </Label>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="space-y-4 border-t border-line-1 pt-4">
          <h3 className="text-sm font-semibold">Payment Summary</h3>

          <div className="rounded-lg border border-line-1 bg-surface-input p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Plan Amount:</span>
              <span className="font-medium">{formatCurrency(planAmount)}</span>
            </div>
            {discountPercentage > 0 && (
              <div className="flex justify-between text-sm text-success">
                <span>Discount ({discountPercentage}%):</span>
                <span className="font-medium">
                  - {formatCurrency((planAmount * discountPercentage) / 100)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold pt-2 border-t border-line-1">
              <span>Payment Amount:</span>
              <span>{formatCurrency(paymentAmount)}</span>
            </div>
            <div className="flex justify-between text-sm text-brand-link pt-2 border-t border-line-1">
              <span>Next Due Date:</span>
              <span className="font-medium">{nextDueDatePreview}</span>
            </div>
          </div>

          {errors.paymentAmount && (
            <p className="text-sm text-error">{errors.paymentAmount.message}</p>
          )}
        </div>

        {/* Error Message */}
        {collectPaymentMutation.isError && (
          <div className="rounded-md bg-error-bg p-4">
            <p className="text-sm text-error">
              {collectPaymentMutation.error instanceof Error
                ? collectPaymentMutation.error.message
                : 'Failed to collect payment'}
            </p>
          </div>
        )}
      </form>
    </Modal>
  )
}
