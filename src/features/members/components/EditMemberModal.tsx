'use client'

import { useEffect, useRef } from 'react'
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

/** "3-months" → "3 months", "monthly" → "Monthly". */
function planLabel(planType: string): string {
  return planType.charAt(0).toUpperCase() + planType.slice(1).replace('-', ' ')
}

/**
 * The message a failed request carries, whichever envelope the route used.
 *
 * `ResponseBuilder` nests it (`{ error: { message, code } }`); a few older
 * routes send a bare string. Reading `body.error` directly turned every
 * failure into `new Error({...})`, which prints as "[object Object]".
 */
function apiErrorMessage(body: unknown, fallback: string): string {
  const detail = (body as { error?: unknown } | null)?.error
  if (typeof detail === 'string' && detail) return detail
  const message = (detail as { message?: unknown } | null)?.message
  return typeof message === 'string' && message ? message : fallback
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

  // Fill the form once per opening of a given member — NOT on every new
  // `member` object. `member` comes from a query that can refetch while the
  // form is open (a response to the click that opened the detail view lands
  // after the owner has started typing); keying this on identity reset the
  // form to the server's values and silently discarded what had been typed.
  const filledFor = useRef<string | null>(null)
  useEffect(() => {
    if (!open) {
      filledFor.current = null
      return
    }
    if (member && filledFor.current !== member.id) {
      filledFor.current = member.id
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
        const body = await response.json().catch(() => null)
        throw new Error(apiErrorMessage(body, 'Failed to update member'))
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      if (member) {
        // Removed, not invalidated: the detail view is closed while this form
        // is open, so its query is disabled and an invalidation only marks it
        // stale without refetching. The next open would then paint the
        // pre-edit record (it is cached for 10 minutes) until the response
        // arrived, which reads as "my change was not saved". Removal makes it
        // show the loading state instead — the same policy as closing detail.
        queryClient.removeQueries({ queryKey: ['member-detail', member.id] })
      }
      toast.success('Member updated successfully')
      onClose()
    },
  })

  const onSubmit = (data: UpdateMemberInput) => {
    updateMemberMutation.mutate(data)
  }

  if (!member) return null

  const isPlanOffered =
    planTypesData?.some(
      (pt) => pt.is_active && pt.plan_type === member.plan_type
    ) ?? false
  const isDiscountOffered = discounts.some(
    (d) => d.is_active && d.id === member.discount_id
  )

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
                    {planLabel(planType.plan_type)}
                    {planType.default_amount > 0 &&
                      ` (LKR ${planType.default_amount.toLocaleString()})`}
                  </option>
                ))}
              {/* The member's own plan stays selectable after the gym
                  deactivates it (or while the list is still loading).
                  Without an option for it a native select shows its first
                  entry instead — the form would display one plan and save
                  another. */}
              {!isPlanOffered && (
                <option value={member.plan_type}>
                  {planLabel(member.plan_type)} (no longer offered)
                </option>
              )}
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
              {/* Same reason as the plan list: a deactivated discount the
                  member still holds must stay visible, or the form reads
                  "No Discount" and saves the old one. */}
              {!isDiscountOffered && member.discount_id && (
                <option value={member.discount_id}>
                  {member.discount
                    ? `${member.discount.discount_name} (${member.discount.discount_percentage}%)`
                    : 'Current discount'}{' '}
                  (no longer offered)
                </option>
              )}
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
