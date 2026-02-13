'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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

interface AddMemberModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AddMemberModal({ open, onClose }: AddMemberModalProps) {
  const queryClient = useQueryClient();
  const [planAmount, setPlanAmount] = useState<number>(0);
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

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
      recurringDiscount: false,
      planType: 'monthly',
    },
  });

  // Watch form values for calculations
  const watchPlanType = watch('planType');
  const watchPlanAmount = watch('planAmount');
  const watchDiscountId = watch('discountId');

  // Default plan amounts
  const defaultPlanAmounts = {
    monthly: 5000,
    daily: 200,
    annual: 50000,
  };

  // Set default plan amount when plan type changes
  useEffect(() => {
    if (watchPlanType) {
      const amount = defaultPlanAmounts[watchPlanType as keyof typeof defaultPlanAmounts];
      setPlanAmount(amount);
      setValue('planAmount', amount);
    }
  }, [watchPlanType, setValue]);

  // Calculate payment amount when plan amount or discount changes
  useEffect(() => {
    if (watchPlanAmount) {
      const amount = watchPlanAmount;
      const discount = discountPercentage;
      const finalAmount = amount - (amount * discount) / 100;
      setPaymentAmount(finalAmount);
      setValue('paymentAmount', finalAmount);
    }
  }, [watchPlanAmount, discountPercentage, setValue]);

  // Create member mutation
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      reset();
      onClose();
    },
  });

  const onSubmit = (data: AddMemberInput) => {
    createMemberMutation.mutate(data);
  };

  // Format phone number as user types
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove non-digits

    // Add +94 prefix if not present
    if (!value.startsWith('94')) {
      if (value.startsWith('0')) {
        value = '94' + value.slice(1);
      } else {
        value = '94' + value;
      }
    }

    // Limit to 11 digits (94 + 9 digits)
    value = value.slice(0, 11);

    // Add + prefix
    const formatted = '+' + value;
    setValue(field as keyof AddMemberInput, formatted as never);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Member</DialogTitle>
          <DialogDescription>
            Fill in the member details and initial payment information.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="phoneNumber">Phone Number *</Label>
              <Input
                id="phoneNumber"
                {...register('phoneNumber')}
                placeholder="+94XXXXXXXXX"
                onChange={(e) => handlePhoneChange(e, 'phoneNumber')}
              />
              {errors.phoneNumber && (
                <p className="text-sm text-red-600 mt-1">{errors.phoneNumber.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="emergencyContactName">Emergency Contact Name</Label>
              <Input
                id="emergencyContactName"
                {...register('emergencyContactName')}
                placeholder="Enter emergency contact name"
              />
            </div>

            <div>
              <Label htmlFor="emergencyContactPhone">Emergency Contact Phone</Label>
              <Input
                id="emergencyContactPhone"
                {...register('emergencyContactPhone')}
                placeholder="+94XXXXXXXXX"
                onChange={(e) => handlePhoneChange(e, 'emergencyContactPhone')}
              />
              {errors.emergencyContactPhone && (
                <p className="text-sm text-red-600 mt-1">{errors.emergencyContactPhone.message}</p>
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
                onValueChange={(value) => setValue('planType', value as 'monthly' | 'daily' | 'annual')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select plan type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
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
              <Label htmlFor="discountId">Discount</Label>
              <Select
                value={watchDiscountId || 'none'}
                onValueChange={(value) => {
                  if (value === 'none') {
                    setValue('discountId', null);
                    setDiscountPercentage(0);
                  } else {
                    setValue('discountId', value);
                    // TODO: Fetch discount percentage from API
                    // For now, hardcode some example discounts
                    if (value === 'student') setDiscountPercentage(10);
                    else if (value === 'senior') setDiscountPercentage(15);
                    else if (value === 'family') setDiscountPercentage(20);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select discount" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Discount</SelectItem>
                  <SelectItem value="student">Student Discount (10%)</SelectItem>
                  <SelectItem value="senior">Senior Discount (15%)</SelectItem>
                  <SelectItem value="family">Family Discount (20%)</SelectItem>
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

          {/* Payment Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Initial Payment</h3>

            <div className="rounded-lg border bg-gray-50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Plan Amount:</span>
                <span className="font-medium">LKR {planAmount.toFixed(2)}</span>
              </div>
              {discountPercentage > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount ({discountPercentage}%):</span>
                  <span className="font-medium">- LKR {((planAmount * discountPercentage) / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold pt-2 border-t">
                <span>Payment Amount:</span>
                <span>LKR {paymentAmount.toFixed(2)}</span>
              </div>
            </div>

            {errors.paymentAmount && (
              <p className="text-sm text-red-600">{errors.paymentAmount.message}</p>
            )}
          </div>

          {/* Error Message */}
          {createMemberMutation.isError && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">
                {createMemberMutation.error instanceof Error
                  ? createMemberMutation.error.message
                  : 'Failed to create member'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onClose();
              }}
              disabled={createMemberMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMemberMutation.isPending}>
              {createMemberMutation.isPending ? 'Creating...' : 'Create Member'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
