'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Modal,
  Button,
  Input,
  Label,
  Select,
  Checkbox,
  Textarea,
} from '@/components/ui'
import { HelpCircle } from 'lucide-react'
import {
  addMemberSchema,
  type AddMemberInput,
} from '@/features/members/schemas/member.schemas'
import QuotaReachedUpsell from '@/features/subscriptions/components/QuotaReachedUpsell'

interface Discount {
  id: string
  discount_name: string
  discount_percentage: number
}

interface PlanType {
  id: string
  gym_id: string
  plan_type: 'daily' | 'weekly' | 'monthly' | '3-months' | '6-months' | 'annual'
  default_amount: number
  is_active: boolean
}

interface AddMemberModalProps {
  open: boolean
  onClose: () => void
}

export default function AddMemberModal({ open, onClose }: AddMemberModalProps) {
  const queryClient = useQueryClient()
  const [currentStep, setCurrentStep] = useState<1 | 2>(1)
  const [discountPercentage, setDiscountPercentage] = useState<number>(0)
  // Whether this registration is charged the gym's admission fee. Ticked by
  // default when the gym has one configured; the desk can waive it per member.
  const [applyAdmissionFee, setApplyAdmissionFee] = useState(true)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AddMemberInput>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      membershipStartDate: new Date().toISOString().split('T')[0],
      planType: 'monthly',
      planAmount: 0, // Will be auto-filled when plan types load
      paymentAmount: 0,
      discountId: null,
      recurringDiscount: false,
      remarks: '',
      acceptedTerms: false,
      acceptedGymRules: false,
    },
  })

  const { data: planTypesData } = useQuery({
    queryKey: ['billing-setup-plan-types'],
    queryFn: async () => {
      const response = await fetch('/api/billing-setup/plans')
      if (!response.ok) throw new Error('Failed to fetch plan types')
      const result = await response.json()
      return result.data as PlanType[]
    },
  })

  const { data: discountsData } = useQuery({
    queryKey: ['billing-setup-discounts'],
    queryFn: async () => {
      const response = await fetch('/api/billing-setup/discounts')
      if (!response.ok) throw new Error('Failed to fetch discounts')
      const result = await response.json()
      return result.data as Discount[]
    },
  })

  const { data: admissionFeeData } = useQuery({
    queryKey: ['billing-setup-admission-fee'],
    queryFn: async () => {
      const response = await fetch('/api/billing-setup/admission-fee')
      if (!response.ok) throw new Error('Failed to fetch admission fee')
      const result = await response.json()
      return result.data as {
        admission_fee: number
        admission_fee_enabled: boolean
      }
    },
  })

  // One-time admission fee configured by the gym (0 when disabled/unset).
  const gymAdmissionFee = admissionFeeData?.admission_fee_enabled
    ? admissionFeeData.admission_fee
    : 0
  // Only offer the choice when the gym actually charges one.
  const admissionFeeAvailable = gymAdmissionFee > 0
  // Amount actually added to this member's first payment.
  const admissionFee =
    admissionFeeAvailable && applyAdmissionFee ? gymAdmissionFee : 0

  const watchPlanType = watch('planType')
  const watchPlanAmount = watch('planAmount')
  const watchDiscountId = watch('discountId')

  // Initialize with first available plan type when data loads
  useEffect(() => {
    if (planTypesData && planTypesData.length > 0) {
      const activePlans = planTypesData.filter((pt) => pt.is_active)
      if (activePlans.length > 0) {
        // Set to first active plan if current selection doesn't exist
        const currentPlan = activePlans.find(
          (pt) => pt.plan_type === watchPlanType
        )
        if (!currentPlan) {
          setValue('planType', activePlans[0].plan_type)
          setValue('planAmount', activePlans[0].default_amount)
        } else if (watchPlanAmount === 0) {
          // Initialize amount for default plan type
          setValue('planAmount', currentPlan.default_amount)
        }
      }
    }
  }, [planTypesData]) // Only run when planTypesData first loads

  // Auto-fill plan amount when plan type changes
  useEffect(() => {
    if (watchPlanType && planTypesData) {
      const planType = planTypesData.find(
        (pt) => pt.plan_type === watchPlanType
      )
      if (planType && planType.default_amount > 0) {
        setValue('planAmount', planType.default_amount)
      }
    }
  }, [watchPlanType, planTypesData, setValue])

  useEffect(() => {
    if (watchPlanAmount) {
      const discounted =
        watchPlanAmount - (watchPlanAmount * discountPercentage) / 100
      setValue('paymentAmount', discounted + admissionFee)
    }
  }, [watchPlanAmount, discountPercentage, admissionFee, setValue])

  // Derived values — single source of truth
  const planAmount = watchPlanAmount || 0
  const discountedAmount =
    Math.round(planAmount * (1 - discountPercentage / 100) * 100) / 100
  const totalDueAmount =
    Math.round((discountedAmount + admissionFee) * 100) / 100

  const createMemberMutation = useMutation({
    mutationFn: async (data: AddMemberInput) => {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        // ApiResponse envelope: {success:false, error:{message, code}}
        const body = await response.json().catch(() => null)
        const err = new Error(
          body?.error?.message || 'Failed to create member'
        ) as Error & { code?: string }
        err.code = body?.error?.code
        throw err
      }

      return response.json()
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      toast.success('Member registered successfully')
      handleClose()
    },
    onError: (error) => {
      // MEMBER_LIMIT_REACHED renders the inline upsell instead of a toast
      if (
        (error as Error & { code?: string }).code === 'MEMBER_LIMIT_REACHED'
      ) {
        return
      }
      toast.error(
        error instanceof Error ? error.message : 'Failed to create member'
      )
    },
  })

  const memberLimitReached =
    (createMemberMutation.error as (Error & { code?: string }) | null)?.code ===
    'MEMBER_LIMIT_REACHED'

  const onSubmit = (data: AddMemberInput) => {
    // Send whether the fee applies, not how much it is. The amount is resolved
    // server-side from the gym row; `paymentAmount` still carries the total so
    // a desk can adjust it, but the recorded fee component is the gym's own
    // configured figure rather than whatever this form computed.
    createMemberMutation.mutate({
      ...data,
      applyAdmissionFee: admissionFeeAvailable && applyAdmissionFee,
    })
  }

  const handleClose = () => {
    const activePlan = planTypesData?.filter((pt) => pt.is_active)?.[0]
    reset({
      membershipStartDate: new Date().toISOString().split('T')[0],
      planType: activePlan?.plan_type ?? 'monthly',
      planAmount: activePlan?.default_amount ?? 0,
      paymentAmount: activePlan?.default_amount ?? 0,
      discountId: null,
      recurringDiscount: false,
      remarks: '',
      acceptedTerms: false,
      acceptedGymRules: false,
    })
    setCurrentStep(1)
    setDiscountPercentage(0)
    setApplyAdmissionFee(true)
    onClose()
  }

  const handleNext = () => {
    // Validate Step 1 fields before proceeding
    const name = watch('name')
    const phoneNumber = watch('phoneNumber')
    const planAmount = watch('planAmount')

    if (!name || !phoneNumber || !planAmount || planAmount <= 0) {
      toast.error('Please fill in all required fields')
      return
    }

    setCurrentStep(2)
  }

  const handleBack = () => {
    setCurrentStep(1)
  }

  const noActivePlans =
    !planTypesData || planTypesData.filter((pt) => pt.is_active).length === 0

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose()
      }}
      size="lg"
      title="Add New Member"
      description={
        currentStep === 1
          ? 'Step 1 of 2: Enter member information and plan details'
          : 'Step 2 of 2: Configure payment method and complete registration'
      }
      footerStart={
        currentStep === 2 ? (
          <Button
            type="button"
            variant="secondary"
            onClick={handleBack}
            disabled={createMemberMutation.isPending}
          >
            Back
          </Button>
        ) : undefined
      }
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={createMemberMutation.isPending}
          >
            Cancel
          </Button>
          {currentStep === 1 ? (
            <Button
              type="button"
              variant="accent"
              onClick={handleNext}
              disabled={noActivePlans}
            >
              Next: Payment
            </Button>
          ) : (
            <Button
              type="submit"
              form="add-member-form"
              variant="accent"
              loading={createMemberMutation.isPending}
              disabled={createMemberMutation.isPending || noActivePlans}
            >
              {createMemberMutation.isPending ? 'Creating...' : 'Create Member'}
            </Button>
          )}
        </>
      }
    >
      {/* Stepper Progress Indicator */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 flex-1">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
              currentStep === 1
                ? 'bg-accentui text-accentui-text'
                : 'bg-success text-accentui-text'
            }`}
          >
            {currentStep === 1 ? '1' : '✓'}
          </div>
          <span
            className={`text-sm font-medium ${currentStep === 1 ? 'text-ink' : 'text-ink-muted'}`}
          >
            Member Info
          </span>
        </div>
        <div className="flex-1 h-0.5 bg-line-1">
          <div
            className={`h-full transition-all duration-300 ${
              currentStep === 2 ? 'bg-accentui w-full' : 'bg-line-1 w-0'
            }`}
          />
        </div>
        <div className="flex items-center gap-2 flex-1">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
              currentStep === 2
                ? 'bg-accentui text-accentui-text'
                : 'bg-surface-selected text-ink-muted'
            }`}
          >
            2
          </div>
          <span
            className={`text-sm font-medium ${currentStep === 2 ? 'text-ink' : 'text-ink-muted'}`}
          >
            Payment
          </span>
        </div>
      </div>

      {/* Free-tier quota reached: keep the form (data preserved), show the upgrade path */}
      {memberLimitReached && <QuotaReachedUpsell />}

      {planTypesData &&
        planTypesData.filter((pt) => pt.is_active).length === 0 && (
          <div className="rounded-sm bg-warning-bg border border-warning-border p-4 mb-4">
            <p className="text-sm text-warning">
              <strong>No plan types configured.</strong> Please go to Settings →
              Plans to configure your membership plan types before adding
              members.
            </p>
          </div>
        )}

      <form
        id="add-member-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6"
      >
        {/* STEP 1: Member Information & Plan */}
        {currentStep === 1 && (
          <>
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
                  <p className="text-sm text-error mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="phoneNumber">WhatsApp Number *</Label>
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
                <Label htmlFor="add-member-plan-select">Plan Type *</Label>
                <Select
                  id="add-member-plan-select"
                  value={watchPlanType ?? ''}
                  onChange={(e) =>
                    setValue(
                      'planType',
                      e.target.value as AddMemberInput['planType']
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
                          ` (Rs. ${planType.default_amount.toLocaleString()})`}
                      </option>
                    ))}
                  {noActivePlans && (
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
                <Label htmlFor="planAmount">Plan Amount (Rs.) *</Label>
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
                <Label htmlFor="add-member-discount-select">
                  Discount (Optional)
                </Label>
                <Select
                  id="add-member-discount-select"
                  value={watchDiscountId || 'none'}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === 'none') {
                      setValue('discountId', null)
                      setDiscountPercentage(0)
                    } else {
                      setValue('discountId', value)
                      const selected = discountsData?.find(
                        (d) => d.id === value
                      )
                      setDiscountPercentage(selected?.discount_percentage || 0)
                    }
                  }}
                >
                  <option value="none">No Discount</option>
                  {discountsData?.map((discount) => (
                    <option key={discount.id} value={discount.id}>
                      {discount.discount_name} ({discount.discount_percentage}%)
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="recurringDiscount"
                  checked={!!watch('recurringDiscount')}
                  onChange={(e) =>
                    setValue('recurringDiscount', e.target.checked)
                  }
                />
                <Label
                  htmlFor="recurringDiscount"
                  className="text-sm font-normal flex items-center gap-1"
                >
                  Apply discount to all future payments
                  <span title="If checked, this discount will automatically apply to all recurring payments for this member, not just the initial payment.">
                    <HelpCircle className="h-3.5 w-3.5 text-ink-muted cursor-help" />
                  </span>
                </Label>
              </div>

              {admissionFeeAvailable && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="applyAdmissionFee"
                    checked={applyAdmissionFee}
                    onChange={(e) => setApplyAdmissionFee(e.target.checked)}
                  />
                  <Label
                    htmlFor="applyAdmissionFee"
                    className="text-sm font-normal flex items-center gap-1"
                  >
                    {`Charge one-time admission fee (Rs. ${gymAdmissionFee.toLocaleString()})`}
                    <span title="Ticked by default when your gym charges an admission fee. Untick to waive it for this member — the fee is added to the first payment only.">
                      <HelpCircle className="h-3.5 w-3.5 text-ink-muted cursor-help" />
                    </span>
                  </Label>
                </div>
              )}

              <div>
                <Label htmlFor="membershipStartDate">
                  Membership Start Date *
                </Label>
                <Input
                  id="membershipStartDate"
                  type="date"
                  {...register('membershipStartDate')}
                />
                {errors.membershipStartDate && (
                  <p className="text-sm text-error mt-1">
                    {errors.membershipStartDate.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="remarks">Remarks (Optional)</Label>
                <Textarea
                  id="remarks"
                  {...register('remarks')}
                  rows={3}
                  placeholder="Any notes about this member"
                />
                {errors.remarks && (
                  <p className="text-sm text-error mt-1">
                    {errors.remarks.message}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* STEP 2: Payment Configuration */}
        {currentStep === 2 && (
          <>
            {/* Payment Summary */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Payment Summary</h3>

              <div className="rounded-sm border border-line-1 bg-surface-input p-4 space-y-2">
                <p className="text-xs font-medium text-ink-muted uppercase tracking-wide">
                  Initial Payment
                </p>
                <div className="flex justify-between text-sm">
                  <span>Plan Amount:</span>
                  <span className="font-medium">
                    Rs. {planAmount.toFixed(2)}
                  </span>
                </div>
                {discountPercentage > 0 && (
                  <div className="flex justify-between text-sm text-success">
                    <span>Discount ({discountPercentage}%):</span>
                    <span className="font-medium">
                      − Rs.{' '}
                      {((planAmount * discountPercentage) / 100).toFixed(2)}
                    </span>
                  </div>
                )}
                {admissionFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Admission Fee (one-time):</span>
                    <span className="font-medium">
                      Rs. {admissionFee.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-base font-semibold pt-2 border-t border-line-1">
                  <span>Payment Amount:</span>
                  <span>Rs. {totalDueAmount.toFixed(2)}</span>
                </div>
              </div>

              {errors.paymentAmount && (
                <p className="text-sm text-error">
                  {errors.paymentAmount.message}
                </p>
              )}
            </div>

            {/* Consents — required to register */}
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="acceptedTerms"
                  checked={!!watch('acceptedTerms')}
                  onChange={(e) => setValue('acceptedTerms', e.target.checked)}
                />
                <Label
                  htmlFor="acceptedTerms"
                  className="text-sm font-normal leading-snug"
                >
                  Member accepts Metric Gym OS&apos;s{' '}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-link underline"
                  >
                    privacy policy
                  </a>{' '}
                  and{' '}
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-link underline"
                  >
                    terms of service
                  </a>
                  .
                </Label>
              </div>
              {errors.acceptedTerms && (
                <p className="text-sm text-error">
                  {errors.acceptedTerms.message}
                </p>
              )}

              <div className="flex items-start gap-2">
                <Checkbox
                  id="acceptedGymRules"
                  checked={!!watch('acceptedGymRules')}
                  onChange={(e) =>
                    setValue('acceptedGymRules', e.target.checked)
                  }
                />
                <Label
                  htmlFor="acceptedGymRules"
                  className="text-sm font-normal leading-snug"
                >
                  Member agrees to the gym&apos;s guidelines and rules.
                </Label>
              </div>
              {errors.acceptedGymRules && (
                <p className="text-sm text-error">
                  {errors.acceptedGymRules.message}
                </p>
              )}
            </div>
          </>
        )}
      </form>
    </Modal>
  )
}
