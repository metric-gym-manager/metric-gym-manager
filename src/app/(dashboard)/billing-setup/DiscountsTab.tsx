'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  Modal,
  Button,
  Input,
  Label,
  Badge,
  Checkbox,
  ListRow,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'
import { useViewportTier } from '@/hooks/useViewportTier'
import {
  createDiscountSchema,
  type CreateDiscountInput,
} from '@/features/settings/schemas/settings.schemas'
import type { Discount } from '@/features/settings/types'

export default function DiscountsTab() {
  const queryClient = useQueryClient()
  const [addModalOpen, setAddModalOpen] = useState(false)
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const phone = useViewportTier() === 'phone'

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateDiscountInput>({
    resolver: zodResolver(createDiscountSchema),
    defaultValues: {
      is_active: true,
    },
  })

  // Fetch discounts
  const { data: discounts, isLoading } = useQuery<Discount[]>({
    queryKey: ['billing-setup-discounts'],
    queryFn: async () => {
      const response = await fetch('/api/billing-setup/discounts')
      if (!response.ok) throw new Error('Failed to fetch discounts')
      const result = await response.json()
      return result.data
    },
  })

  // Active-member usage per discount (In-use column). Read-only count, owned by
  // the members feature (GET /api/members/discount-usage).
  const { data: usage } = useQuery<
    { discountId: string; memberCount: number }[]
  >({
    queryKey: ['members', 'discount-usage'],
    queryFn: async () => {
      const response = await fetch('/api/members/discount-usage')
      if (!response.ok) throw new Error('Failed to fetch discount usage')
      const result = await response.json()
      return result.data
    },
    staleTime: 60_000,
  })
  const usageMap = new Map(
    (usage ?? []).map((u) => [u.discountId, u.memberCount])
  )

  // Create discount mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateDiscountInput) => {
      const response = await fetch('/api/billing-setup/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create discount')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-setup-discounts'] })
      queryClient.invalidateQueries({ queryKey: ['discounts'] }) // Legacy support
      reset()
      setAddModalOpen(false)
    },
  })

  // Toggle discount active status
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await fetch(`/api/billing-setup/discounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update discount')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-setup-discounts'] })
      queryClient.invalidateQueries({ queryKey: ['discounts'] }) // Legacy support
    },
  })

  // Delete discount mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/billing-setup/discounts/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete discount')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-setup-discounts'] })
      queryClient.invalidateQueries({ queryKey: ['discounts'] }) // Legacy support
    },
  })

  const onSubmit = (data: CreateDiscountInput) => {
    createMutation.mutate(data)
  }

  const handleDelete = async (discount: Discount) => {
    const confirmed = await confirm({
      title: 'Delete Discount',
      description: `Are you sure you want to delete "${discount.discount_name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
    })

    if (confirmed) {
      deleteMutation.mutate(discount.id)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Discounts</h2>
        </div>
        <Button variant="accent" onClick={() => setAddModalOpen(true)}>
          Add Discount
        </Button>
      </div>

      {/* Discounts Table */}
      <Card className="overflow-x-auto">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-ink-muted">Loading discounts...</p>
          </div>
        ) : discounts && discounts.length > 0 ? (
          phone ? (
            /*
             * The desktop keeps its five-column `Table`; a phone gets rows.
             * The table lives in a `Card` that is itself `overflow-x-auto`, so
             * on a phone it did not widen the page — it hid three columns
             * inside a scroller with no visual cue, which is the audit's
             * "overflowing tables hid here" case (probe rule 3).
             */
            <ul role="list">
              {discounts.map((discount) => (
                <ListRow
                  key={discount.id}
                  primary={discount.discount_name}
                  status={
                    <Badge variant={discount.is_active ? 'success' : 'neutral'}>
                      {discount.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  }
                  meta={[
                    `${discount.discount_percentage}% off`,
                    `${usageMap.get(discount.id) ?? 0} in use`,
                  ]}
                  actions={
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          toggleMutation.mutate({
                            id: discount.id,
                            isActive: discount.is_active,
                          })
                        }
                        disabled={toggleMutation.isPending}
                      >
                        {discount.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(discount)}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </Button>
                    </>
                  }
                />
              ))}
            </ul>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Discount Name</TableHead>
                  <TableHead>Percentage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead numeric>In use</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discounts.map((discount) => (
                  <TableRow key={discount.id}>
                    <TableCell className="font-medium">
                      {discount.discount_name}
                    </TableCell>
                    <TableCell>{discount.discount_percentage}%</TableCell>
                    <TableCell>
                      <Badge
                        variant={discount.is_active ? 'success' : 'neutral'}
                      >
                        {discount.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell numeric>
                      {usageMap.get(discount.id) ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            toggleMutation.mutate({
                              id: discount.id,
                              isActive: discount.is_active,
                            })
                          }
                          disabled={toggleMutation.isPending}
                        >
                          {discount.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(discount)}
                          disabled={deleteMutation.isPending}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        ) : (
          <div className="flex h-48 items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-ink-muted">No discounts created yet</p>
              <p className="text-xs text-ink-muted mt-1">
                Click &quot;Add Discount&quot; to create your first discount
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Error Messages */}
      {(toggleMutation.isError || deleteMutation.isError) && (
        <div className="rounded-sm bg-error-bg p-4">
          <p className="text-sm text-error">
            {toggleMutation.error instanceof Error
              ? toggleMutation.error.message
              : deleteMutation.error instanceof Error
                ? deleteMutation.error.message
                : 'An error occurred'}
          </p>
        </div>
      )}

      {/* Add Discount Modal */}
      <Modal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        placement="sheet"
        title="Add New Discount"
        description="Create a discount preset that can be applied to member registrations"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                reset()
                setAddModalOpen(false)
              }}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="add-discount-form"
              variant="accent"
              loading={createMutation.isPending}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Discount'}
            </Button>
          </>
        }
      >
        <form
          id="add-discount-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="discount_name">Discount Name *</Label>
            <Input
              id="discount_name"
              {...register('discount_name')}
              placeholder="e.g., Student Discount, Senior Discount"
            />
            {errors.discount_name && (
              <p className="text-sm text-error mt-1">
                {errors.discount_name.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="discount_percentage">Discount Percentage *</Label>
            <Input
              id="discount_percentage"
              type="number"
              {...register('discount_percentage', { valueAsNumber: true })}
              placeholder="e.g., 10"
              min="1"
              max="100"
            />
            {errors.discount_percentage && (
              <p className="text-sm text-error mt-1">
                {errors.discount_percentage.message}
              </p>
            )}
            <p className="text-xs text-ink-muted mt-1">
              Enter a value between 1 and 100
            </p>
          </div>

          {/* `Checkbox label=` rather than a sibling `Label htmlFor=`: the
              44 px hit area belongs to a label that WRAPS its control (§15.1).
              A bare checkbox is 24 px on a phone, under the probe's floor. */}
          <Checkbox
            id="is_active"
            {...register('is_active')}
            defaultChecked
            label="Active (available for selection)"
          />

          {/* Error Message */}
          {createMutation.isError && (
            <div className="rounded-sm bg-error-bg p-4">
              <p className="text-sm text-error">
                {createMutation.error instanceof Error
                  ? createMutation.error.message
                  : 'Failed to create discount'}
              </p>
            </div>
          )}
        </form>
      </Modal>

      {/* Confirmation Dialog */}
      <ConfirmDialog />
    </div>
  )
}
