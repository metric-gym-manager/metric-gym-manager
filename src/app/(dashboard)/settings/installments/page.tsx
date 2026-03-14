'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface InstallmentTemplate {
  id: string;
  name: string;
  description: string | null;
  installment_count: number;
  interval_months: number;
  is_active: boolean;
  created_at: string;
}

export default function InstallmentsSettingsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    installment_count: 2,
    interval_months: 1,
  });
  const [formError, setFormError] = useState('');

  const { data: templates, isLoading } = useQuery<InstallmentTemplate[]>({
    queryKey: ['installment-templates'],
    queryFn: async () => {
      const res = await fetch('/api/installment-templates');
      if (!res.ok) throw new Error('Failed to fetch');
      const result = await res.json();
      return result.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch('/api/installment-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installment-templates'] });
      setShowForm(false);
      setFormData({ name: '', description: '', installment_count: 2, interval_months: 1 });
      setFormError('');
      toast.success('Installment plan created');
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : 'Failed to create');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const res = await fetch(`/api/installment-templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active }),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installment-templates'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/installment-templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installment-templates'] });
      toast.success('Installment plan deleted');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Name is required');
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Installment Plans</h2>
        </div>
        <Button
          onClick={() => { setShowForm(!showForm); setFormError(''); }}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {showForm ? 'Cancel' : '+ New Template'}
        </Button>
      </div>

      {/* Add Template Form */}
      {showForm && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-blue-900">New Payment Plan</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="inst-name">Plan Name *</Label>
                <Input
                  id="inst-name"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. 3-Month Payment Plan"
                  className="bg-white"
                />
              </div>
              <div>
                <Label htmlFor="inst-desc">Description</Label>
                <Input
                  id="inst-desc"
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Optional description"
                  className="bg-white"
                />
              </div>
              <div>
                <Label htmlFor="inst-count">Number of Installments *</Label>
                <Input
                  id="inst-count"
                  type="number"
                  min={2}
                  max={24}
                  value={formData.installment_count}
                  onChange={(e) => setFormData((p) => ({ ...p, installment_count: parseInt(e.target.value) || 2 }))}
                  className="bg-white"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 2 installments</p>
              </div>
              <div>
                <Label htmlFor="inst-interval">Interval Between Payments (months) *</Label>
                <Input
                  id="inst-interval"
                  type="number"
                  min={1}
                  max={12}
                  value={formData.interval_months}
                  onChange={(e) => setFormData((p) => ({ ...p, interval_months: parseInt(e.target.value) || 1 }))}
                  className="bg-white"
                />
              </div>
            </div>

            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
                {createMutation.isPending ? 'Creating...' : 'Create Template'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Templates List */}
      {isLoading ? (
        <div className="text-sm text-gray-500">Loading payment plans...</div>
      ) : !templates || templates.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center">
          <p className="text-sm text-gray-500">No payment plans yet.</p>
          <p className="text-xs text-gray-400 mt-2 max-w-md mx-auto">
            Create a payment plan to let members split their fees into smaller monthly payments. For example, a "3-Month Plan" breaks a Rs. 15,000 membership into 3 payments of Rs. 5,000 each.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Plan Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Description</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Installments</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Interval</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 text-gray-500">{t.description || '—'}</td>
                  <td className="px-4 py-3">{t.installment_count} payments</td>
                  <td className="px-4 py-3">Every {t.interval_months} month{t.interval_months > 1 ? 's' : ''}</td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        t.is_active
                          ? 'border-transparent bg-green-100 text-green-800'
                          : 'border-transparent bg-gray-100 text-gray-600'
                      }
                    >
                      {t.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleActiveMutation.mutate({ id: t.id, is_active: !t.is_active })}
                        disabled={toggleActiveMutation.isPending}
                      >
                        {t.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => deleteMutation.mutate(t.id)}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
