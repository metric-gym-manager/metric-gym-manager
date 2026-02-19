'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Badge } from '@/components/ui/badge';
import { collectPaymentSchema, type CollectPaymentInput } from '@/features/members/schemas/member.schemas';
import type { OverdueMember } from '@/features/members/types';

interface PaymentCollectionModalProps {
  open: boolean;
  onClose: () => void;
  member: OverdueMember | null;
}

export default function PaymentCollectionModal({ open, onClose, member }: PaymentCollectionModalProps) {
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
  } = useForm<Omit<CollectPaymentInput, 'memberId'>>({
    resolver: zodResolver(collectPaymentSchema.omit({ memberId: true })),
    defaultValues: {
      paymentDate: new Date().toISOString().split('T')[0],
      deductOverduePeriod: true,
    },
  });

  // Watch form values
  const watchPlanAmount = watch('planAmount');
  const watchDiscountId = watch('discountId');

  // Initialize form when member changes
  useEffect(() => {
    if (member) {
      setPlanAmount(member.plan_amount);
      setValue('planAmount', member.plan_amount);

      // Pre-select discount if recurring
      if (member.recurring_discount && member.discount_id) {
        setValue('discountId', member.discount_id);
        // TODO: Fetch actual discount percentage
        setDiscountPercentage(member.discount?.discount_percentage || 0);
      } else {
        setValue('discountId', null);
        setDiscountPercentage(0);
      }
    }
  }, [member, setValue]);

  // Calculate payment amount
  useEffect(() => {
    if (watchPlanAmount) {
      const amount = watchPlanAmount;
      const discount = discountPercentage;
      const finalAmount = amount - (amount * discount) / 100;
      setPaymentAmount(finalAmount);
      setValue('paymentAmount', finalAmount);
    }
  }, [watchPlanAmount, discountPercentage, setValue]);

  // Collect payment mutation
  const collectPaymentMutation = useMutation({
    mutationFn: async (data: CollectPaymentInput) => {
      const response = await fetch(`/api/members/${data.memberId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to collect payment');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['regular-payments'] });
      queryClient.invalidateQueries({ queryKey: ['sms-reminders'] });
      toast.success('Payment collected — receipt SMS sent');
      reset();
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to collect payment');
    },
  });

  const onSubmit = (data: Omit<CollectPaymentInput, 'memberId'>) => {
    if (!member) return;

    collectPaymentMutation.mutate({
      ...data,
      memberId: member.id,
    });
  };

  if (!member) return null;

  // Format currency
  const formatCurrency = (amount: number) => {
    return `LKR ${amount.toFixed(2)}`;
  };

  // Calculate next due date preview
  const calculateNextDueDate = () => {
    const deductOverdue = watch('deductOverduePeriod');
    const paymentDate = new Date(watch('paymentDate'));
    let nextDue: Date;

    if (deductOverdue) {
      nextDue = new Date(paymentDate);
    } else {
      nextDue = new Date(member.next_due_date);
    }

    // Add plan duration
    switch (member.plan_type) {
      case 'daily':
        nextDue.setDate(nextDue.getDate() + 1);
        break;
      case 'monthly':
        nextDue.setDate(nextDue.getDate() + 30);
        break;
      case 'annual':
        nextDue.setDate(nextDue.getDate() + 365);
        break;
    }

    return nextDue.toLocaleDateString('en-GB');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Collect Payment</DialogTitle>
          <DialogDescription>
            Record payment for overdue member
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Member Information */}
          <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm text-gray-500">Member Name</Label>
                <p className="text-base font-semibold">{member.name}</p>
              </div>
              <Badge variant="destructive">
                Overdue by {member.days_overdue} days
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-500">Phone Number</Label>
                <p className="text-sm font-medium">{member.phone_number}</p>
              </div>

              <div>
                <Label className="text-sm text-gray-500">Plan Type</Label>
                <p className="text-sm font-medium capitalize">{member.plan_type}</p>
              </div>

              <div>
                <Label className="text-sm text-gray-500">Original Due Date</Label>
                <p className="text-sm font-medium">
                  {new Date(member.next_due_date).toLocaleDateString('en-GB')}
                </p>
              </div>

              <div>
                <Label className="text-sm text-gray-500">Status</Label>
                <Badge variant="secondary">{member.status}</Badge>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Payment Details</h3>

            <div>
              <Label htmlFor="paymentDate">Payment Date *</Label>
              <Input
                id="paymentDate"
                type="date"
                {...register('paymentDate')}
              />
              {errors.paymentDate && (
                <p className="text-sm text-red-600 mt-1">{errors.paymentDate.message}</p>
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
                    // For now, use member's existing discount or hardcoded values
                    if (member.discount && value === member.discount_id) {
                      setDiscountPercentage(member.discount.discount_percentage);
                    } else {
                      if (value === 'student') setDiscountPercentage(10);
                      else if (value === 'senior') setDiscountPercentage(15);
                      else if (value === 'family') setDiscountPercentage(20);
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select discount" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Discount</SelectItem>
                  {member.discount && (
                    <SelectItem value={member.discount_id || ''}>
                      {member.discount.discount_name} ({member.discount.discount_percentage}%)
                    </SelectItem>
                  )}
                  <SelectItem value="student">Student Discount (10%)</SelectItem>
                  <SelectItem value="senior">Senior Discount (15%)</SelectItem>
                  <SelectItem value="family">Family Discount (20%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="deductOverduePeriod"
                checked={watch('deductOverduePeriod')}
                onCheckedChange={(checked) => setValue('deductOverduePeriod', !!checked)}
              />
              <Label htmlFor="deductOverduePeriod" className="text-sm font-normal">
                Deduct overdue period (start new cycle from payment date)
              </Label>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-semibold">Payment Summary</h3>

            <div className="rounded-lg border bg-gray-50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Plan Amount:</span>
                <span className="font-medium">{formatCurrency(planAmount)}</span>
              </div>
              {discountPercentage > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount ({discountPercentage}%):</span>
                  <span className="font-medium">
                    - {formatCurrency((planAmount * discountPercentage) / 100)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold pt-2 border-t">
                <span>Payment Amount:</span>
                <span>{formatCurrency(paymentAmount)}</span>
              </div>
              <div className="flex justify-between text-sm text-blue-600 pt-2 border-t">
                <span>Next Due Date:</span>
                <span className="font-medium">{calculateNextDueDate()}</span>
              </div>
            </div>

            {errors.paymentAmount && (
              <p className="text-sm text-red-600">{errors.paymentAmount.message}</p>
            )}
          </div>

          {/* Error Message */}
          {collectPaymentMutation.isError && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">
                {collectPaymentMutation.error instanceof Error
                  ? collectPaymentMutation.error.message
                  : 'Failed to collect payment'}
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
              disabled={collectPaymentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={collectPaymentMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {collectPaymentMutation.isPending ? 'Processing...' : 'Collect Payment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
