'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { createDiscountSchema, type CreateDiscountInput } from '@/features/settings/schemas/settings.schemas';
import type { Discount } from '@/features/settings/types';

export default function DiscountsTab() {
  const queryClient = useQueryClient();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const { confirm, ConfirmDialog } = useConfirmDialog();

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
  });

  // Fetch discounts
  const { data: discounts, isLoading } = useQuery<Discount[]>({
    queryKey: ['billing-setup-discounts'],
    queryFn: async () => {
      const response = await fetch('/api/billing-setup/discounts');
      if (!response.ok) throw new Error('Failed to fetch discounts');
      const result = await response.json();
      return result.data;
    },
  });

  // Create discount mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateDiscountInput) => {
      const response = await fetch('/api/billing-setup/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create discount');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-setup-discounts'] });
      queryClient.invalidateQueries({ queryKey: ['discounts'] }); // Legacy support
      reset();
      setAddModalOpen(false);
    },
  });

  // Toggle discount active status
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await fetch(`/api/billing-setup/discounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update discount');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-setup-discounts'] });
      queryClient.invalidateQueries({ queryKey: ['discounts'] }); // Legacy support
    },
  });

  // Delete discount mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/billing-setup/discounts/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete discount');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-setup-discounts'] });
      queryClient.invalidateQueries({ queryKey: ['discounts'] }); // Legacy support
    },
  });

  const onSubmit = (data: CreateDiscountInput) => {
    createMutation.mutate(data);
  };

  const handleDelete = async (discount: Discount) => {
    const confirmed = await confirm({
      title: 'Delete Discount',
      description: `Are you sure you want to delete "${discount.discount_name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
    });

    if (confirmed) {
      deleteMutation.mutate(discount.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Discounts</h2>
        </div>
        <Button onClick={() => setAddModalOpen(true)}>Add Discount</Button>
      </div>

      {/* Discounts Table */}
      <div className="rounded-lg border bg-white">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-gray-500">Loading discounts...</p>
          </div>
        ) : discounts && discounts.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Discount Name</TableHead>
                <TableHead>Percentage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {discounts.map((discount) => (
                <TableRow key={discount.id}>
                  <TableCell className="font-medium">{discount.discount_name}</TableCell>
                  <TableCell>{discount.discount_percentage}%</TableCell>
                  <TableCell>
                    <Badge variant={discount.is_active ? 'default' : 'secondary'}>
                      {discount.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleMutation.mutate({ id: discount.id, isActive: discount.is_active })}
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
        ) : (
          <div className="flex h-48 items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-gray-500">No discounts created yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Click &quot;Add Discount&quot; to create your first discount
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error Messages */}
      {(toggleMutation.isError || deleteMutation.isError) && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">
            {toggleMutation.error instanceof Error
              ? toggleMutation.error.message
              : deleteMutation.error instanceof Error
              ? deleteMutation.error.message
              : 'An error occurred'}
          </p>
        </div>
      )}

      {/* Add Discount Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Discount</DialogTitle>
            <DialogDescription>
              Create a discount preset that can be applied to member registrations
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="discount_name">Discount Name *</Label>
              <Input
                id="discount_name"
                {...register('discount_name')}
                placeholder="e.g., Student Discount, Senior Discount"
              />
              {errors.discount_name && (
                <p className="text-sm text-red-600 mt-1">{errors.discount_name.message}</p>
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
                <p className="text-sm text-red-600 mt-1">{errors.discount_percentage.message}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Enter a value between 1 and 100</p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                {...register('is_active')}
                className="h-4 w-4 rounded border-gray-300"
                defaultChecked
              />
              <Label htmlFor="is_active" className="text-sm font-normal">
                Active (available for selection)
              </Label>
            </div>

            {/* Error Message */}
            {createMutation.isError && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">
                  {createMutation.error instanceof Error
                    ? createMutation.error.message
                    : 'Failed to create discount'}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset();
                  setAddModalOpen(false);
                }}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Discount'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <ConfirmDialog />
    </div>
  );
}
