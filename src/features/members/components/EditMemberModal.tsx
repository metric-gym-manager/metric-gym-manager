'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Modal, Button, Input, Label, Select, Checkbox } from '@/components/ui'
import {
  updateMemberSchema,
  type UpdateMemberInput,
} from '@/features/members/schemas/member.schemas'
import type { MemberWithDiscount } from '@/features/members/types'
import { toast } from 'sonner'
import { formatDate } from '@/utils/date/date'

interface Discount {
  id: string
  discount_name: string
  discount_percentage: number
  is_active: boolean
}

interface PlanType {
  id: string
  gym_id: string
  plan_type: 'daily' | 'weekly' | 'monthly' | '3-months' | '6-months' | 'annual'
  default_amount: number
  is_active: boolean
}

interface EditMemberModalProps {
  open: boolean
  onClose: () => void
  member: MemberWithDiscount | null
}

export default function EditMemberModal({
  open,
  onClose,
  member,
}: EditMemberModalProps) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<UpdateMemberInput>({
    resolver: zodResolver(updateMemberSchema),
  })

  // Watch form values
  const watchPlanType = watch('planType')
  const watchDiscountId = watch('discountId')

  // Fetch plan types
  const { data: planTypesData } = useQuery<PlanType[]>({
    queryKey: ['billing-setup-plan-types'],
    queryFn: async () => {
      const response = await fetch('/api/billing-setup/plans')
      if (!response.ok) throw new Error('Failed to fetch plan types')
      const result = await response.json()
      return result.data as PlanType[]
    },
  })

  // Fetch discounts
  const { data: discountsData } = useQuery<Discount[]>({
    queryKey: ['billing-setup-discounts'],
    queryFn: async () => {
      const response = await fetch('/api/billing-setup/discounts')
      if (!response.ok) throw new Error('Failed to fetch discounts')
      const result = await response.json()
      return result.data as Discount[]
    },
  })

  const discounts = discountsData || []

  // Auto-fill plan amount when plan type changes (only if not editing existing member)
  useEffect(() => {
    if (watchPlanType && planTypesData && !member) {
      const planType = planTypesData.find(
        (pt) => pt.plan_type === watchPlanType
      )
      if (planType && planType.default_amount > 0) {
        setValue('planAmount', planType.default_amount)
      }
    }
  }, [watchPlanType, planTypesData, member, setValue])

  // Reset form when member changes or modal opens
  useEffect(() => {
    if (member && open) {
      reset({
        name: member.name,
        phoneNumber: member.phone_number,
        planType: member.plan_type,
        planAmount: member.plan_amount,
        discountId: member.discount_id || undefined,
        recurringDiscount: member.recurring_discount,
      })
    }
  }, [member, open, reset])

  // Update member mutation
  const updateMemberMutation = useMutation({
    mutationFn: async (data: UpdateMemberInput) => {
      if (!member) throw new Error('No member selected')

      const response = await fetch(`/api/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update member')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      if (member) {
        queryClient.invalidateQueries({
          queryKey: ['member-detail', member.id],
        })
      }
      toast.success('Member updated successfully')
      onClose()
    },
  })

  const onSubmit = (data: UpdateMemberInput) => {
    updateMemberMutation.mutate(data)
  }

  if (!member) return null

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      size="lg"
      // Same form, one step (§8.5). Fullscreen so detail → edit → back →
      // detail is a sequence of screens on a phone rather than stacked
      // dialogs.
      placement="fullscreen"
      title="Edit Member"
      description="Update member details and membership plan."
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={updateMemberMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-member-form"
            variant="accent"
            loading={updateMemberMutation.isPending}
            disabled={updateMemberMutation.isPending}
          >
            {updateMemberMutation.isPending ? 'Updating...' : 'Update Member'}
          </Button>
        </>
      }
    >
      <form
        id="edit-member-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6"
      >
        {/* Member Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Member Information</h3>

          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Enter member name"
            />
            {errors.name && (
              <p className="text-sm text-error mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="phoneNumber">Phone Number *</Label>
            <Input
              id="phoneNumber"
              {...register('phoneNumber')}
              placeholder="0771234567"
            />
            {errors.phoneNumber && (
              <p className="text-sm text-error mt-1">
                {errors.phoneNumber.message}
              </p>
            )}
          </div>
        </div>

        {/* Membership Plan */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Membership Plan</h3>

          <div>
            <Label htmlFor="edit-member-plan-select">Plan Type *</Label>
            <Select
              id="edit-member-plan-select"
              value={watchPlanType ?? ''}
              onChange={(e) =>
                setValue(
                  'planType',
                  e.target.value as UpdateMemberInput['planType']
                )
              }
            >
              <option value="" disabled>
                Select plan type
              </option>
              {planTypesData
                ?.filter((pt) => pt.is_active)
                .map((planType) => (
                  <option key={planType.id} value={planType.plan_type}>
                    {planType.plan_type.charAt(0).toUpperCase() +
                      planType.plan_type.slice(1).replace('-', ' ')}
                    {planType.default_amount > 0 &&
                      ` (LKR ${planType.default_amount.toLocaleString()})`}
                  </option>
                ))}
              {(!planTypesData ||
                planTypesData.filter((pt) => pt.is_active).length === 0) && (
                <option value="__no_plans__" disabled>
                  No active plan types configured
                </option>
              )}
            </Select>
            {errors.planType && (
              <p className="text-sm text-error mt-1">
                {errors.planType.message}
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
            <Label htmlFor="edit-member-discount-select">Discount</Label>
            <Select
              id="edit-member-discount-select"
              value={watchDiscountId || 'none'}
              onChange={(e) => {
                const value = e.target.value
                setValue('discountId', value === 'none' ? null : value)
              }}
            >
              <option value="none">No Discount</option>
              {discounts
                .filter((d) => d.is_active)
                .map((discount) => (
                  <option key={discount.id} value={discount.id}>
                    {discount.discount_name} ({discount.discount_percentage}%)
                  </option>
                ))}
            </Select>
          </div>

          {/* §15.1: 24 px control inside a 44 px LABEL — the label has to
              wrap the input, not just point at it (see AddMemberModal). */}
          <Label
            htmlFor="recurringDiscount"
            className="flex items-center gap-2 text-sm font-normal phone:min-h-touch"
          >
            <Checkbox
              id="recurringDiscount"
              checked={watch('recurringDiscount')}
              onChange={(e) => setValue('recurringDiscount', e.target.checked)}
            />
            <span>Apply discount to all future payments</span>
          </Label>
        </div>

        {/* Read-only Information */}
        <div className="space-y-4 border-t border-line-1 pt-4">
          <h3 className="text-sm font-semibold text-ink-secondary">
            Read-Only Information
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-ink-muted">Registered Date</Label>
              <p className="font-medium">
                {formatDate(member.registered_date)}
              </p>
            </div>
            <div>
              <Label className="text-ink-muted">Next Due Date</Label>
              <p className="font-medium">{formatDate(member.next_due_date)}</p>
            </div>
          </div>
          <p className="text-xs text-ink-muted">
            Note: To change the member status, use the dedicated action buttons
            (Suspend, Activate, Cancel) in the member detail modal. Next due
            date will be recalculated when you collect a payment.
          </p>
        </div>

        {/* Error Message */}
        {updateMemberMutation.isError && (
          <div className="rounded-sm bg-error-bg p-4">
            <p className="text-sm text-error">
              {updateMemberMutation.error instanceof Error
                ? updateMemberMutation.error.message
                : 'Failed to update member'}
            </p>
          </div>
        )}
      </form>
    </Modal>
  )
}
