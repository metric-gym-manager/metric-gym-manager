'use client';

import { useEffect, useState } from 'react';
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
import { HelpCircle } from 'lucide-react';
import { addMemberSchema, type AddMemberInput } from '@/features/members/schemas/member.schemas';

interface Discount {
  id: string;
  discount_name: string;
  discount_percentage: number;
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

export default function AddMemberModal({ open, onClose }: AddMemberModalProps) {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);

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
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('Member registered successfully');
      handleClose();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create member');
    },
  });

  const onSubmit = (data: AddMemberInput) => {
    createMemberMutation.mutate(data);
  };

  const handleClose = () => {
    const activePlan = planTypesData?.filter((pt) => pt.is_active)?.[0];
    reset({
      membershipStartDate: new Date().toISOString().split('T')[0],
      planType: activePlan?.plan_type ?? 'monthly',
      planAmount: activePlan?.default_amount ?? 0,
      paymentAmount: activePlan?.default_amount ?? 0,
      discountId: null,
      recurringDiscount: false,
    });
    setCurrentStep(1);
    setDiscountPercentage(0);
    onClose();
  };

  const handleNext = () => {
    // Validate Step 1 fields before proceeding
    const name = watch('name');
    const phoneNumber = watch('phoneNumber');
    const planAmount = watch('planAmount');

    if (!name || !phoneNumber || !planAmount || planAmount <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    setCurrentStep(2);
  };

  const handleBack = () => {
    setCurrentStep(1);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Member</DialogTitle>
          <DialogDescription>
            {currentStep === 1
              ? 'Step 1 of 2: Enter member information and plan details'
              : 'Step 2 of 2: Configure payment method and complete registration'
            }
          </DialogDescription>
        </DialogHeader>

        {/* Stepper Progress Indicator */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-2 flex-1">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
              currentStep === 1
                ? 'bg-blue-600 text-white'
                : 'bg-green-500 text-white'
            }`}>
              {currentStep === 1 ? '1' : '✓'}
            </div>
            <span className={`text-sm font-medium ${currentStep === 1 ? 'text-gray-900' : 'text-gray-500'}`}>
              Member Info
            </span>
          </div>
          <div className="flex-1 h-0.5 bg-gray-200">
            <div className={`h-full transition-all duration-300 ${
              currentStep === 2 ? 'bg-blue-600 w-full' : 'bg-gray-200 w-0'
            }`} />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
              currentStep === 2
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}>
              2
            </div>
            <span className={`text-sm font-medium ${currentStep === 2 ? 'text-gray-900' : 'text-gray-500'}`}>
              Payment
            </span>
          </div>
        </div>

        {planTypesData && planTypesData.filter((pt) => pt.is_active).length === 0 && (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
            <p className="text-sm text-yellow-800">
              <strong>No plan types configured.</strong> Please go to Settings → Plans to configure your membership plan types before adding members.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* STEP 1: Member Information & Plan */}
          {currentStep === 1 && (
            <>
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
                        {planType.default_amount > 0 && ` (Rs. ${planType.default_amount.toLocaleString()})`}
                      </SelectItem>
                    ))}
                  {(!planTypesData || planTypesData.filter((pt) => pt.is_active).length === 0) && (
                    <SelectItem value="__no_plans__" disabled>
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
              <Label htmlFor="planAmount">Plan Amount (Rs.) *</Label>
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
              <Label htmlFor="recurringDiscount" className="text-sm font-normal flex items-center gap-1">
                Apply discount to all future payments
                <span title="If checked, this discount will automatically apply to all recurring payments for this member, not just the initial payment.">
                  <HelpCircle className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                </span>
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
            </>
          )}

          {/* STEP 2: Payment Configuration */}
          {currentStep === 2 && (
            <>
              {/* Payment Summary */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Payment Summary</h3>

                <div className="rounded-lg border bg-gray-50 p-4 space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Initial Payment
                  </p>
                  <div className="flex justify-between text-sm">
                    <span>Plan Amount:</span>
                    <span className="font-medium">Rs. {planAmount.toFixed(2)}</span>
                  </div>
                  {discountPercentage > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount ({discountPercentage}%):</span>
                      <span className="font-medium">
                        − Rs. {(planAmount * discountPercentage / 100).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-semibold pt-2 border-t">
                    <span>Payment Amount:</span>
                    <span>Rs. {discountedAmount.toFixed(2)}</span>
                  </div>
                </div>

                {errors.paymentAmount && (
                  <p className="text-sm text-red-600">{errors.paymentAmount.message}</p>
                )}
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-between gap-3 pt-4 border-t">
            <div>
              {currentStep === 2 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={createMemberMutation.isPending}
                >
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={createMemberMutation.isPending}
              >
                Cancel
              </Button>
              {currentStep === 1 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={
                    !planTypesData ||
                    planTypesData.filter((pt) => pt.is_active).length === 0
                  }
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Next: Payment
                </Button>
              ) : (
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
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
