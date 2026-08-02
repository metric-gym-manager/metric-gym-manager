'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Label, Badge, Select, Checkbox } from '@/components/ui'
import { Plus, Trash2 } from 'lucide-react'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'
import type { PlanType } from '@/features/settings/types'
import type {
  UpdatePlanTypeInput,
  PlanTypeEnum,
} from '@/features/settings/schemas/settings.schemas'

// All available plan types
const ALL_PLAN_TYPES: { value: PlanTypeEnum; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: '3-months', label: '3 Months' },
  { value: '6-months', label: '6 Months' },
  { value: 'annual', label: 'Annual' },
]

export default function PlanTypesTab() {
  const queryClient = useQueryClient()
  const [editingPlan, setEditingPlan] = useState<string | null>(null)
  const [planValues, setPlanValues] = useState<
    Record<string, { amount: number; isActive: boolean }>
  >({})
  const { confirm, ConfirmDialog } = useConfirmDialog()

  // Add new plan state
  const [isAddingPlan, setIsAddingPlan] = useState(false)
  const [newPlanType, setNewPlanType] = useState<PlanTypeEnum | ''>('')
  const [newPlanAmount, setNewPlanAmount] = useState<number>(0)

  // Fetch plan types
  const { data: planTypes, isLoading } = useQuery<PlanType[]>({
    queryKey: ['billing-setup-plan-types'],
    queryFn: async () => {
      const response = await fetch('/api/billing-setup/plans')
      if (!response.ok) throw new Error('Failed to fetch plan types')
      const result = await response.json()
      return result.data
    },
  })

  // Active-member enrolment per plan type (Enrolled column). Read-only count,
  // owned by the members feature (GET /api/members/enrolment-by-plan).
  const { data: enrolment } = useQuery<
    { planType: string; activeCount: number }[]
  >({
    queryKey: ['members', 'enrolment-by-plan'],
    queryFn: async () => {
      const response = await fetch('/api/members/enrolment-by-plan')
      if (!response.ok) throw new Error('Failed to fetch enrolment by plan')
      const result = await response.json()
      return result.data
    },
    staleTime: 60_000,
  })
  const enrolMap = new Map(
    (enrolment ?? []).map((e) => [e.planType, e.activeCount])
  )

  // Create plan type mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      plan_type: PlanTypeEnum
      default_amount: number
      is_active: boolean
    }) => {
      const response = await fetch('/api/billing-setup/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create plan type')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-setup-plan-types'] })
      queryClient.invalidateQueries({ queryKey: ['plan-types'] }) // Legacy support
      setIsAddingPlan(false)
      setNewPlanType('')
      setNewPlanAmount(0)
    },
  })

  // Update plan type mutation
  const updateMutation = useMutation({
    mutationFn: async (data: UpdatePlanTypeInput) => {
      const response = await fetch('/api/billing-setup/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update plan type')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-setup-plan-types'] })
      queryClient.invalidateQueries({ queryKey: ['plan-types'] }) // Legacy support
      setEditingPlan(null)
      setPlanValues({})
    },
  })

  // Delete plan type mutation
  const deleteMutation = useMutation({
    mutationFn: async (planType: PlanTypeEnum) => {
      const response = await fetch('/api/billing-setup/plans', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_type: planType }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete plan type')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-setup-plan-types'] })
      queryClient.invalidateQueries({ queryKey: ['plan-types'] }) // Legacy support
    },
  })

  const handleEdit = (plan: PlanType) => {
    setEditingPlan(plan.plan_type)
    setPlanValues({
      ...planValues,
      [plan.plan_type]: {
        amount: plan.default_amount,
        isActive: plan.is_active,
      },
    })
  }

  const handleSave = (planType: string) => {
    const values = planValues[planType]
    if (!values) return

    updateMutation.mutate({
      plan_type: planType as PlanTypeEnum,
      default_amount: values.amount,
      is_active: values.isActive,
    })
  }

  const handleCancel = () => {
    setEditingPlan(null)
    setPlanValues({})
  }

  const handleCancelAdd = () => {
    setIsAddingPlan(false)
    setNewPlanType('')
    setNewPlanAmount(0)
  }

  const handleAddPlan = () => {
    if (!newPlanType || newPlanAmount <= 0) return

    createMutation.mutate({
      plan_type: newPlanType,
      default_amount: newPlanAmount,
      is_active: true,
    })
  }

  const handleDelete = async (planType: PlanTypeEnum) => {
    const confirmed = await confirm({
      title: 'Delete Plan Type',
      description: `Are you sure you want to delete the ${getPlanLabel(planType)} plan type? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
    })

    if (confirmed) {
      deleteMutation.mutate(planType)
    }
  }

  const toggleActive = (
    planType: string,
    currentActive: boolean,
    currentAmount: number
  ) => {
    updateMutation.mutate({
      plan_type: planType as PlanTypeEnum,
      default_amount: currentAmount,
      is_active: !currentActive,
    })
  }

  const getPlanLabel = (planType: string) => {
    const plan = ALL_PLAN_TYPES.find((p) => p.value === planType)
    return plan?.label || planType.charAt(0).toUpperCase() + planType.slice(1)
  }

  // Get available plan types (not yet created)
  const existingPlanTypes = planTypes?.map((p) => p.plan_type) || []
  const availablePlanTypes = ALL_PLAN_TYPES.filter(
    (p) => !existingPlanTypes.includes(p.value)
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Plan Types</h2>
          <p className="text-sm text-ink-muted mt-1">
            Manage membership plan types and their default pricing
          </p>
        </div>
        {!isAddingPlan && availablePlanTypes.length > 0 && (
          <Button
            variant="accent"
            onClick={() => setIsAddingPlan(true)}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Plan Type
          </Button>
        )}
      </div>

      {/* Add New Plan Form */}
      {isAddingPlan && (
        <div className="rounded-lg border bg-accentui-bg border-accentui-border p-6">
          <h3 className="text-base font-semibold mb-4">Add New Plan Type</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="billing-setup-plan-type-select">Plan Type</Label>
              <Select
                id="billing-setup-plan-type-select"
                value={newPlanType}
                onChange={(e) => setNewPlanType(e.target.value as PlanTypeEnum)}
              >
                <option value="" disabled>
                  Select plan type
                </option>
                {availablePlanTypes.map((plan) => (
                  <option key={plan.value} value={plan.value}>
                    {plan.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="new-plan-amount">Default Amount (LKR)</Label>
              <Input
                id="new-plan-amount"
                type="number"
                value={newPlanAmount || ''}
                onChange={(e) =>
                  setNewPlanAmount(parseFloat(e.target.value) || 0)
                }
                min="0"
                step="0.01"
                placeholder="Enter default amount"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="accent"
                onClick={handleAddPlan}
                disabled={
                  !newPlanType || newPlanAmount <= 0 || createMutation.isPending
                }
                size="sm"
              >
                {createMutation.isPending ? 'Adding...' : 'Add Plan Type'}
              </Button>
              <Button
                variant="secondary"
                onClick={handleCancelAdd}
                disabled={createMutation.isPending}
                size="sm"
              >
                Cancel
              </Button>
            </div>

            {createMutation.isError && (
              <p className="text-sm text-error">
                {createMutation.error instanceof Error
                  ? createMutation.error.message
                  : 'Failed to create plan type'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Plan Types List */}
      <div className="rounded-lg border border-line-1 bg-surface-card">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-ink-muted">Loading plan types...</p>
          </div>
        ) : planTypes && planTypes.length > 0 ? (
          <div className="divide-y divide-line-1">
            {planTypes.map((plan) => {
              const isEditing = editingPlan === plan.plan_type
              const currentValues = planValues[plan.plan_type] || {
                amount: plan.default_amount,
                isActive: plan.is_active,
              }

              return (
                <div key={plan.plan_type} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-base font-semibold">
                          {getPlanLabel(plan.plan_type)} Plan
                        </h3>
                        <Badge variant={plan.is_active ? 'success' : 'neutral'}>
                          {plan.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="neutral">
                          {enrolMap.get(plan.plan_type) ?? 0} enrolled
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
                            <Checkbox
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
                            />
                            <Label
                              htmlFor={`active-${plan.plan_type}`}
                              className="text-sm font-normal"
                            >
                              Active (available for new members)
                            </Label>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <Button
                              variant="accent"
                              size="sm"
                              onClick={() => handleSave(plan.plan_type)}
                              disabled={updateMutation.isPending}
                            >
                              {updateMutation.isPending ? 'Saving...' : 'Save'}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={handleCancel}
                              disabled={updateMutation.isPending}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-ink-secondary">
                            Default Amount:{' '}
                            <span className="font-medium text-ink">
                              LKR {plan.default_amount.toFixed(2)}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleEdit(plan)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant={plan.is_active ? 'secondary' : 'accent'}
                          size="sm"
                          onClick={() =>
                            toggleActive(
                              plan.plan_type,
                              plan.is_active,
                              plan.default_amount
                            )
                          }
                          disabled={updateMutation.isPending}
                        >
                          {plan.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          variant="destructive-ghost"
                          size="sm"
                          onClick={() =>
                            handleDelete(plan.plan_type as PlanTypeEnum)
                          }
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-ink-muted mb-4">
                No plan types configured yet
              </p>
              {availablePlanTypes.length > 0 && (
                <Button
                  variant="accent"
                  onClick={() => setIsAddingPlan(true)}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Plan Type
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error Messages */}
      {updateMutation.isError && (
        <div className="rounded-md bg-error-bg p-4">
          <p className="text-sm text-error">
            {updateMutation.error instanceof Error
              ? updateMutation.error.message
              : 'Failed to update plan type'}
          </p>
        </div>
      )}

      {deleteMutation.isError && (
        <div className="rounded-md bg-error-bg p-4">
          <p className="text-sm text-error">
            {deleteMutation.error instanceof Error
              ? deleteMutation.error.message
              : 'Failed to delete plan type'}
          </p>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog />
    </div>
  )
}
