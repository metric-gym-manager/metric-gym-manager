'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { updateMemberSchema, type UpdateMemberInput } from '@/features/members/schemas/member.schemas';
import type { MemberWithDiscount } from '@/features/members/types';

interface Discount {
  id: string;
  discount_name: string;
  discount_percentage: number;
  is_active: boolean;
}

interface EditMemberModalProps {
  open: boolean;
  onClose: () => void;
  member: MemberWithDiscount | null;
}

export default function EditMemberModal({ open, onClose, member }: EditMemberModalProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<UpdateMemberInput>({
    resolver: zodResolver(updateMemberSchema),
  });

  // Watch form values
  const watchPlanType = watch('planType');
  const watchDiscountId = watch('discountId');

  // Fetch discounts
  const { data: discountsData } = useQuery<{ success: boolean; data: Discount[] }>({
    queryKey: ['discounts'],
    queryFn: async () => {
      const response = await fetch('/api/settings/discounts');
      if (!response.ok) throw new Error('Failed to fetch discounts');
      return response.json();
    },
  });

  const discounts = discountsData?.data || [];

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
      setValue('planAmount', amount);
    }
  }, [watchPlanType, setValue]);

  // Reset form when member changes or modal opens
  useEffect(() => {
    if (member && open) {
      reset({
        name: member.name,
        phoneNumber: member.phone_number,
        emergencyContactName: member.emergency_contact_name || undefined,
        emergencyContactPhone: member.emergency_contact_phone || undefined,
        planType: member.plan_type,
        planAmount: member.plan_amount,
        discountId: member.discount_id || undefined,
        recurringDiscount: member.recurring_discount,
      });
    }
  }, [member, open, reset]);

  // Update member mutation
  const updateMemberMutation = useMutation({
    mutationFn: async (data: UpdateMemberInput) => {
      if (!member) throw new Error('No member selected');

      const response = await fetch(`/api/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update member');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      if (member) {
        queryClient.invalidateQueries({ queryKey: ['member', member.id] });
      }
      onClose();
    },
  });

  const onSubmit = (data: UpdateMemberInput) => {
    updateMemberMutation.mutate(data);
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Member</DialogTitle>
          <DialogDescription>
            Update member details and membership plan.
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
                placeholder="0771234567"
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
              {errors.emergencyContactName && (
                <p className="text-sm text-red-600 mt-1">{errors.emergencyContactName.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="emergencyContactPhone">Emergency Contact Phone</Label>
              <Input
                id="emergencyContactPhone"
                {...register('emergencyContactPhone')}
                placeholder="0771234567"
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
                  } else {
                    setValue('discountId', value);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select discount" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Discount</SelectItem>
                  {discounts
                    .filter((d) => d.is_active)
                    .map((discount) => (
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
          </div>

          {/* Read-only Information */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-600">Read-Only Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-gray-500">Registered Date</Label>
                <p className="font-medium">
                  {new Date(member.registered_date).toLocaleDateString('en-GB')}
                </p>
              </div>
              <div>
                <Label className="text-gray-500">Next Due Date</Label>
                <p className="font-medium">
                  {new Date(member.next_due_date).toLocaleDateString('en-GB')}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Note: To change the status, use the status dropdown in the member detail modal.
              Next due date will be recalculated when you collect a payment.
            </p>
          </div>

          {/* Error Message */}
          {updateMemberMutation.isError && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">
                {updateMemberMutation.error instanceof Error
                  ? updateMemberMutation.error.message
                  : 'Failed to update member'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={updateMemberMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMemberMutation.isPending}>
              {updateMemberMutation.isPending ? 'Updating...' : 'Update Member'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
