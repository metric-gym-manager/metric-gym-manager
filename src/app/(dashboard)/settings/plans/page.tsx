'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { PlanType } from '@/features/settings/types';
import type { UpdatePlanTypeInput } from '@/features/settings/schemas/settings.schemas';

export default function PlanTypesPage() {
  const queryClient = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [planValues, setPlanValues] = useState<Record<string, { amount: number; isActive: boolean }>>({});

  // Fetch plan types
  const { data: planTypes, isLoading } = useQuery<PlanType[]>({
    queryKey: ['plan-types'],
    queryFn: async () => {
      const response = await fetch('/api/settings/plans');
      if (!response.ok) throw new Error('Failed to fetch plan types');
      const result = await response.json();
      return result.data;
    },
  });

  // Update plan type mutation
  const updateMutation = useMutation({
    mutationFn: async (data: UpdatePlanTypeInput) => {
      const response = await fetch('/api/settings/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update plan type');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-types'] });
      setEditingPlan(null);
      setPlanValues({});
    },
  });

  const handleEdit = (plan: PlanType) => {
    setEditingPlan(plan.plan_type);
    setPlanValues({
      ...planValues,
      [plan.plan_type]: {
        amount: plan.default_amount,
        isActive: plan.is_active,
      },
    });
  };

  const handleSave = (planType: string) => {
    const values = planValues[planType];
    if (!values) return;

    updateMutation.mutate({
      plan_type: planType as 'monthly' | 'daily' | 'annual',
      default_amount: values.amount,
      is_active: values.isActive,
    });
  };

  const handleCancel = () => {
    setEditingPlan(null);
    setPlanValues({});
  };

  const toggleActive = (planType: string, currentActive: boolean, currentAmount: number) => {
    updateMutation.mutate({
      plan_type: planType as 'monthly' | 'daily' | 'annual',
      default_amount: currentAmount,
      is_active: !currentActive,
    });
  };

  const getPlanLabel = (planType: string) => {
    return planType.charAt(0).toUpperCase() + planType.slice(1);
  };

  // Default plan types
  const defaultPlans: PlanType[] = [
    { id: '', gym_id: '', plan_type: 'monthly', default_amount: 5000, is_active: true, created_at: '', updated_at: '' },
    { id: '', gym_id: '', plan_type: 'daily', default_amount: 200, is_active: true, created_at: '', updated_at: '' },
    { id: '', gym_id: '', plan_type: 'annual', default_amount: 50000, is_active: true, created_at: '', updated_at: '' },
  ];

  const displayPlans = planTypes && planTypes.length > 0 ? planTypes : defaultPlans;

  return (
    <div className="max-w-3xl">
      <div className="space-y-6">
        {/* Description */}
        <div>
          <h2 className="text-lg font-semibold">Plan Types</h2>
        </div>

        {/* Plan Types Table */}
        <div className="rounded-lg border bg-white">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <p className="text-sm text-gray-500">Loading plan types...</p>
            </div>
          ) : (
            <div className="divide-y">
              {displayPlans.map((plan) => {
                const isEditing = editingPlan === plan.plan_type;
                const currentValues = planValues[plan.plan_type] || {
                  amount: plan.default_amount,
                  isActive: plan.is_active,
                };

                return (
                  <div key={plan.plan_type} className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-base font-semibold">
                            {getPlanLabel(plan.plan_type)} Plan
                          </h3>
                          <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                            {plan.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>

                        {isEditing ? (
                          <div className="space-y-3 mt-4 max-w-md">
                            <div>
                              <Label htmlFor={`amount-${plan.plan_type}`}>
                                Default Amount (LKR)
                              </Label>
                              <Input
                                id={`amount-${plan.plan_type}`}
                                type="number"
                                value={currentValues.amount}
                                onChange={(e) =>
                                  setPlanValues({
                                    ...planValues,
                                    [plan.plan_type]: {
                                      ...currentValues,
                                      amount: parseFloat(e.target.value) || 0,
                                    },
                                  })
                                }
                                min="0"
                                step="0.01"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`active-${plan.plan_type}`}
                                checked={currentValues.isActive}
                                onChange={(e) =>
                                  setPlanValues({
                                    ...planValues,
                                    [plan.plan_type]: {
                                      ...currentValues,
                                      isActive: e.target.checked,
                                    },
                                  })
                                }
                                className="h-4 w-4 rounded border-gray-300"
                              />
                              <Label htmlFor={`active-${plan.plan_type}`} className="text-sm font-normal">
                                Active (available for new members)
                              </Label>
                            </div>

                            <div className="flex gap-2 pt-2">
                              <Button
                                size="sm"
                                onClick={() => handleSave(plan.plan_type)}
                                disabled={updateMutation.isPending}
                              >
                                {updateMutation.isPending ? 'Saving...' : 'Save'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancel}
                                disabled={updateMutation.isPending}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-sm text-gray-600">
                              Default Amount:{' '}
                              <span className="font-medium text-gray-900">
                                LKR {plan.default_amount.toFixed(2)}
                              </span>
                            </p>
                          </div>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(plan)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant={plan.is_active ? 'outline' : 'default'}
                            size="sm"
                            onClick={() => toggleActive(plan.plan_type, plan.is_active, plan.default_amount)}
                            disabled={updateMutation.isPending}
                          >
                            {plan.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Error Message */}
        {updateMutation.isError && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">
              {updateMutation.error instanceof Error
                ? updateMutation.error.message
                : 'Failed to update plan type'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
