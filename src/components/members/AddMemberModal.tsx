'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { addMemberSchema, type AddMemberInput } from '@/features/members/schemas/member.schemas';

interface Discount {
  id: string;
  discount_name: string;
  discount_percentage: number;
}

interface InstallmentTemplate {
  id: string;
  name: string;
  description: string | null;
  installment_count: number;
  interval_months: number;
  is_active: boolean;
}

interface PlanType {
  id: string;
  gym_id: string;
  plan_type: 'daily' | 'weekly' | 'monthly' | '3-months' | '6-months' | 'annual';
  default_amount: number;
  is_active: boolean;
}

interface AddMemberModalProps {
  open: boolean;
  onClose: () => void;
}

// Captured at submit time so onSuccess can read stable values
interface SubmitContext {
  discountedAmount: number;
  template: InstallmentTemplate | null;
  startDate: string;
}

export default function AddMemberModal({ open, onClose }: AddMemberModalProps) {
  const queryClient = useQueryClient();
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'standard' | 'installment'>('standard');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [installmentStartDate, setInstallmentStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Stable reference for values needed in onSuccess
  const submitContextRef = useRef<SubmitContext | null>(null);

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
    },
  });

  const { data: planTypesData } = useQuery({
    queryKey: ['plan-types'],
    queryFn: async () => {
      const response = await fetch('/api/settings/plans');
      if (!response.ok) throw new Error('Failed to fetch plan types');
      const result = await response.json();
      return result.data as PlanType[];
    },
  });

  const { data: discountsData } = useQuery({
    queryKey: ['discounts'],
    queryFn: async () => {
      const response = await fetch('/api/discounts');
      if (!response.ok) throw new Error('Failed to fetch discounts');
      const result = await response.json();
      return result.data as Discount[];
    },
  });

  const { data: templatesData } = useQuery<InstallmentTemplate[]>({
    queryKey: ['installment-templates'],
    queryFn: async () => {
      const response = await fetch('/api/installment-templates');
      if (!response.ok) throw new Error('Failed to fetch templates');
      const result = await response.json();
      return (result.data as InstallmentTemplate[]).filter((t) => t.is_active);
    },
  });

  const watchPlanType = watch('planType');
  const watchPlanAmount = watch('planAmount');
  const watchDiscountId = watch('discountId');

  // Initialize with first available plan type when data loads
  useEffect(() => {
    if (planTypesData && planTypesData.length > 0) {
      const activePlans = planTypesData.filter((pt) => pt.is_active);
      if (activePlans.length > 0) {
        // Set to first active plan if current selection doesn't exist
        const currentPlan = activePlans.find((pt) => pt.plan_type === watchPlanType);
        if (!currentPlan) {
          setValue('planType', activePlans[0].plan_type);
          setValue('planAmount', activePlans[0].default_amount);
        } else if (watchPlanAmount === 0) {
          // Initialize amount for default plan type
          setValue('planAmount', currentPlan.default_amount);
        }
      }
    }
  }, [planTypesData]); // Only run when planTypesData first loads

  // Auto-fill plan amount when plan type changes
  useEffect(() => {
    if (watchPlanType && planTypesData) {
      const planType = planTypesData.find((pt) => pt.plan_type === watchPlanType);
      if (planType && planType.default_amount > 0) {
        setValue('planAmount', planType.default_amount);
      }
    }
  }, [watchPlanType, planTypesData, setValue]);

  useEffect(() => {
    if (watchPlanAmount) {
      const finalAmount = watchPlanAmount - (watchPlanAmount * discountPercentage) / 100;
      setValue('paymentAmount', finalAmount);
    }
  }, [watchPlanAmount, discountPercentage, setValue]);

  // Derived values — single source of truth
  const planAmount = watchPlanAmount || 0;
  const discountedAmount = Math.round(planAmount * (1 - discountPercentage / 100) * 100) / 100;
  const selectedTemplate = templatesData?.find((t) => t.id === selectedTemplateId) ?? null;
  const amountPerInstallment =
    selectedTemplate && discountedAmount > 0
      ? Math.round((discountedAmount / selectedTemplate.installment_count) * 100) / 100
      : 0;

  const createMemberMutation = useMutation({
    mutationFn: async (data: AddMemberInput) => {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create member');
      }

      return response.json();
    },
    onSuccess: async (result) => {
      const ctx = submitContextRef.current;

      if (paymentMode === 'installment' && ctx?.template && ctx.discountedAmount > 0) {
        const memberId = result.data.id;
        await fetch(`/api/members/${memberId}/installments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template_id: ctx.template.id,
            template_name: ctx.template.name,
            total_amount: ctx.discountedAmount,
            installment_count: ctx.template.installment_count,
            interval_months: ctx.template.interval_months,
            start_date: ctx.startDate,
          }),
        });
      }

      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('Member registered successfully');
      handleClose();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create member');
    },
  });

  const onSubmit = (data: AddMemberInput) => {
    // Capture stable context before async mutation
    submitContextRef.current = {
      discountedAmount,
      template: selectedTemplate,
      startDate: installmentStartDate,
    };
    createMemberMutation.mutate(data);
  };

  const handleClose = () => {
    reset();
    setPaymentMode('standard');
    setSelectedTemplateId('');
    setDiscountPercentage(0);
    setInstallmentStartDate(new Date().toISOString().split('T')[0]);
    submitContextRef.current = null;
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Member</DialogTitle>
          <DialogDescription>
            Fill in the member details and initial payment information.
          </DialogDescription>
        </DialogHeader>

        {planTypesData && planTypesData.filter((pt) => pt.is_active).length === 0 && (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
            <p className="text-sm text-yellow-800">
              <strong>No plan types configured.</strong> Please go to Settings → Plans to configure your membership plan types before adding members.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Member Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Member Information</h3>

            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" {...register('name')} placeholder="Enter member name" />
              {errors.name && (
                <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="phoneNumber">Phone Number *</Label>
              <Input id="phoneNumber" {...register('phoneNumber')} placeholder="0771234567" />
              {errors.phoneNumber && (
                <p className="text-sm text-red-600 mt-1">{errors.phoneNumber.message}</p>
              )}
            </div>
          </div>

          {/* Membership Plan */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Membership Plan</h3>

            <div>
              <Label htmlFor="planType">Plan Type *</Label>
              <Select
                value={watchPlanType}
                onValueChange={(value) =>
                  setValue('planType', value as AddMemberInput['planType'])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select plan type" />
                </SelectTrigger>
                <SelectContent>
                  {planTypesData
                    ?.filter((pt) => pt.is_active)
                    .map((planType) => (
                      <SelectItem key={planType.id} value={planType.plan_type}>
                        {planType.plan_type.charAt(0).toUpperCase() + planType.plan_type.slice(1).replace('-', ' ')}
                        {planType.default_amount > 0 && ` (LKR ${planType.default_amount.toLocaleString()})`}
                      </SelectItem>
                    ))}
                  {(!planTypesData || planTypesData.filter((pt) => pt.is_active).length === 0) && (
                    <SelectItem value="" disabled>
                      No active plan types configured
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {errors.planType && (
                <p className="text-sm text-red-600 mt-1">{errors.planType.message}</p>
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
                <p className="text-sm text-red-600 mt-1">{errors.planAmount.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="discountId">Discount (Optional)</Label>
              <Select
                value={watchDiscountId || 'none'}
                onValueChange={(value) => {
                  if (value === 'none') {
                    setValue('discountId', null);
                    setDiscountPercentage(0);
                  } else {
                    setValue('discountId', value);
                    const selected = discountsData?.find((d) => d.id === value);
                    setDiscountPercentage(selected?.discount_percentage || 0);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select discount" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Discount</SelectItem>
                  {discountsData?.map((discount) => (
                    <SelectItem key={discount.id} value={discount.id}>
                      {discount.discount_name} ({discount.discount_percentage}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="recurringDiscount"
                checked={watch('recurringDiscount')}
                onCheckedChange={(checked) => setValue('recurringDiscount', !!checked)}
              />
              <Label htmlFor="recurringDiscount" className="text-sm font-normal">
                Apply discount to all future payments
              </Label>
            </div>

            <div>
              <Label htmlFor="membershipStartDate">Membership Start Date *</Label>
              <Input
                id="membershipStartDate"
                type="date"
                {...register('membershipStartDate')}
              />
              {errors.membershipStartDate && (
                <p className="text-sm text-red-600 mt-1">{errors.membershipStartDate.message}</p>
              )}
            </div>
          </div>

          {/* Payment Mode */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Payment Method</h3>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPaymentMode('standard')}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  paymentMode === 'standard'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Standard Payment
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode('installment')}
                disabled={!templatesData || templatesData.length === 0}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  paymentMode === 'installment'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                Installment Plan
                {(!templatesData || templatesData.length === 0) && (
                  <span className="block text-xs text-gray-400 font-normal">No templates configured</span>
                )}
              </button>
            </div>

            {/* Standard payment summary */}
            {paymentMode === 'standard' && (
              <div className="rounded-lg border bg-gray-50 p-4 space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Initial Payment
                </p>
                <div className="flex justify-between text-sm">
                  <span>Plan Amount:</span>
                  <span className="font-medium">LKR {planAmount.toFixed(2)}</span>
                </div>
                {discountPercentage > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount ({discountPercentage}%):</span>
                    <span className="font-medium">
                      − LKR {(planAmount * discountPercentage / 100).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-base font-semibold pt-2 border-t">
                  <span>Payment Amount:</span>
                  <span>LKR {discountedAmount.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Installment configuration */}
            {paymentMode === 'installment' && templatesData && templatesData.length > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-4">
                <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">
                  Installment Configuration
                </p>

                <div>
                  <Label htmlFor="installment-template">Installment Template *</Label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select a payment template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templatesData.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.installment_count} payments × every {t.interval_months} month
                          {t.interval_months > 1 ? 's' : ''})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="installment-start">First Payment Date *</Label>
                  <Input
                    id="installment-start"
                    type="date"
                    value={installmentStartDate}
                    onChange={(e) => setInstallmentStartDate(e.target.value)}
                    className="bg-white"
                  />
                </div>

                {/* Preview — auto-derived from discounted plan amount */}
                {selectedTemplate && (
                  <div className="rounded-lg border bg-white p-3 space-y-1.5">
                    <p className="text-xs font-medium text-gray-500">Payment Schedule Preview</p>
                    <div className="flex justify-between text-sm">
                      <span>Plan Amount:</span>
                      <span className="font-medium">LKR {planAmount.toFixed(2)}</span>
                    </div>
                    {discountPercentage > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Discount ({discountPercentage}%):</span>
                        <span className="font-medium">
                          − LKR {(planAmount * discountPercentage / 100).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm pt-1 border-t">
                      <span>Installment Total:</span>
                      <span className="font-medium">LKR {discountedAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Number of Payments:</span>
                      <span className="font-medium">{selectedTemplate.installment_count}</span>
                    </div>
                    <div className="flex justify-between text-base font-semibold text-blue-700 pt-1 border-t">
                      <span>Per Installment:</span>
                      <span>LKR {amountPerInstallment.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {!selectedTemplate && (
                  <p className="text-xs text-blue-600">
                    Select a template to see the payment schedule.
                  </p>
                )}
              </div>
            )}

            {errors.paymentAmount && (
              <p className="text-sm text-red-600">{errors.paymentAmount.message}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createMemberMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createMemberMutation.isPending ||
                !planTypesData ||
                planTypesData.filter((pt) => pt.is_active).length === 0
              }
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createMemberMutation.isPending ? 'Creating...' : 'Create Member'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
