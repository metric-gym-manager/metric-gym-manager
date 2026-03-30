'use client';

import { useState, useRef, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { parseApiError } from '@/lib/utils/api-error';

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

interface BulkRow {
  id: string;
  name: string;
  phoneNumber: string;
  planType: 'daily' | 'weekly' | 'monthly' | '3-months' | '6-months' | 'annual';
  planAmount: number;
  membershipStartDate: string;
  discountId: string | null;
  recurringDiscount: boolean;
  status: 'idle' | 'success' | 'error';
  errorMessage?: string;
}

interface BulkAddMemberModalProps {
  open: boolean;
  onClose: () => void;
}

const TODAY = new Date().toISOString().split('T')[0];

function createEmptyRow(): BulkRow {
  return {
    id: crypto.randomUUID(),
    name: '',
    phoneNumber: '',
    planType: 'monthly',
    planAmount: 0, // Will be set when plan types are loaded
    membershipStartDate: TODAY,
    discountId: null,
    recurringDiscount: false,
    status: 'idle',
  };
}

function computeDiscountedAmount(planAmount: number, discountPct: number): number {
  return Math.round(planAmount * (1 - discountPct / 100) * 100) / 100;
}

export default function BulkAddMemberModal({ open, onClose }: BulkAddMemberModalProps) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<BulkRow[]>([createEmptyRow(), createEmptyRow(), createEmptyRow()]);
  const [submitted, setSubmitted] = useState(false);
  const tableEndRef = useRef<HTMLDivElement>(null);

  // Apply-to-all: plan
  const [globalPlanType, setGlobalPlanType] = useState<BulkRow['planType']>('monthly');
  const [globalPlanAmount, setGlobalPlanAmount] = useState<number>(0);
  const [globalStartDate, setGlobalStartDate] = useState<string>(TODAY);

  // Apply-to-all: discount
  const [globalDiscountId, setGlobalDiscountId] = useState<string>('');
  const [globalRecurring, setGlobalRecurring] = useState(false);

  const { data: planTypesData } = useQuery<PlanType[]>({
    queryKey: ['billing-setup-plan-types'],
    queryFn: async () => {
      const res = await fetch('/api/billing-setup/plans');
      if (!res.ok) throw new Error('Failed to fetch plan types');
      const r = await res.json();
      return r.data;
    },
  });

  const { data: discountsData} = useQuery<Discount[]>({
    queryKey: ['billing-setup-discounts'],
    queryFn: async () => {
      const res = await fetch('/api/billing-setup/discounts');
      if (!res.ok) throw new Error('Failed to fetch discounts');
      const r = await res.json();
      return r.data;
    },
  });

  // Initialize with first available plan type when data loads
  useEffect(() => {
    if (planTypesData && planTypesData.length > 0) {
      const activePlans = planTypesData.filter((pt) => pt.is_active);
      if (activePlans.length > 0) {
        const firstPlan = activePlans[0];
        setGlobalPlanType(firstPlan.plan_type);
        setGlobalPlanAmount(firstPlan.default_amount);

        // Initialize all rows with first plan
        setRows((prev) =>
          prev.map((row) => ({
            ...row,
            planType: firstPlan.plan_type,
            planAmount: firstPlan.default_amount,
          }))
        );
      }
    }
  }, [planTypesData]); // Only run when planTypesData first loads

  // Auto-fill global plan amount when global plan type changes
  useEffect(() => {
    if (globalPlanType && planTypesData) {
      const planType = planTypesData.find((pt) => pt.plan_type === globalPlanType);
      if (planType && planType.default_amount > 0) {
        setGlobalPlanAmount(planType.default_amount);
      }
    }
  }, [globalPlanType, planTypesData]);

  // Derive discounted amount for a row
  const getRowDiscountPct = (row: BulkRow): number => {
    if (!row.discountId) return 0;
    return discountsData?.find((d) => d.id === row.discountId)?.discount_percentage ?? 0;
  };

  const bulkRegisterMutation = useMutation({
    mutationFn: async (members: BulkRow[]) => {
      const payload = members.map((row) => {
        return {
          name: row.name.trim(),
          phoneNumber: row.phoneNumber.trim(),
          planType: row.planType,
          planAmount: row.planAmount,
          paymentAmount: row.planAmount,
          membershipStartDate: row.membershipStartDate,
          discountId: row.discountId || null,
          recurringDiscount: row.recurringDiscount,
        };
      });

      const response = await fetch('/api/members/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members: payload }),
      });

      if (!response.ok) {
        const errorMessage = await parseApiError(response);
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: (result) => {
      const { results, summary } = result.data;

      setRows((prev) =>
        prev.map((row, i) => {
          const match = results.find((r: { index: number; success: boolean; error?: string }) => r.index === i);
          if (!match) return row;
          return { ...row, status: match.success ? 'success' : 'error', errorMessage: match.error };
        })
      );

      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['members'] });

      if (summary.failed === 0) {
        toast.success(`All ${summary.succeeded} members registered successfully`);
      } else {
        toast.warning(`${summary.succeeded} registered, ${summary.failed} failed — review errors below`);
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Bulk registration failed');
    },
  });

  const handleRowChange = (id: string, field: keyof BulkRow, value: string | number | boolean | null) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value, status: 'idle' as const, errorMessage: undefined };
        if (field === 'planType') {
          const planType = planTypesData?.find((pt) => pt.plan_type === value);
          updated.planAmount = planType?.default_amount ?? 0;
        }
        return updated;
      })
    );
  };

  const handleApplyPlanToAll = () => {
    setRows((prev) =>
      prev.map((row) =>
        row.status === 'success'
          ? row
          : {
              ...row,
              planType: globalPlanType,
              planAmount: globalPlanAmount,
              membershipStartDate: globalStartDate,
              status: 'idle' as const,
              errorMessage: undefined,
            }
      )
    );
  };

  const handleApplyDiscountToAll = () => {
    setRows((prev) =>
      prev.map((row) =>
        row.status === 'success'
          ? row
          : {
              ...row,
              discountId: globalDiscountId || null,
              recurringDiscount: globalRecurring,
              status: 'idle' as const,
              errorMessage: undefined,
            }
      )
    );
  };

  const handleAddRow = () => {
    const activePlan = planTypesData?.find((pt) => pt.is_active && pt.plan_type === globalPlanType)
      ?? planTypesData?.find((pt) => pt.is_active);
    const newRow: BulkRow = {
      ...createEmptyRow(),
      planType: activePlan?.plan_type ?? 'monthly',
      planAmount: activePlan?.default_amount ?? globalPlanAmount,
    };
    setRows((prev) => [...prev, newRow]);
    setTimeout(() => tableEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const handleDeleteRow = (id: string) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((r) => r.id !== id);
    });
  };

  const validateRow = (row: BulkRow): string | null => {
    if (!row.name.trim()) return 'Name is required';
    if (!row.phoneNumber.trim()) return 'WhatsApp number is required';
    if (row.planAmount <= 0) return 'Plan amount must be > 0';
    if (!row.membershipStartDate) return 'Start date is required';
    return null;
  };

  const validRows = rows.filter((r) => !validateRow(r));
  const hasAnyFilledRow = rows.some((r) => r.name.trim() || r.phoneNumber.trim());

  const handleRegisterAll = () => {
    const updatedRows = rows.map((row) => {
      const err = validateRow(row);
      if (err) return { ...row, status: 'error' as const, errorMessage: err };
      return { ...row, status: 'idle' as const, errorMessage: undefined };
    });
    setRows(updatedRows);

    const toSubmit = updatedRows.filter((r) => r.status !== 'error' && validateRow(r) === null);
    if (toSubmit.length === 0) {
      toast.error('No valid rows to submit. Fix errors and try again.');
      return;
    }

    bulkRegisterMutation.mutate(toSubmit);
  };

  const handleClose = () => {
    const activePlan = planTypesData?.filter((pt) => pt.is_active)?.[0];
    const defaultPlanType = activePlan?.plan_type ?? 'monthly';
    const defaultAmount = activePlan?.default_amount ?? 0;

    const freshRows = [createEmptyRow(), createEmptyRow(), createEmptyRow()].map((row) => ({
      ...row,
      planType: defaultPlanType,
      planAmount: defaultAmount,
    }));

    setRows(freshRows);
    setSubmitted(false);
    setGlobalPlanType(defaultPlanType);
    setGlobalPlanAmount(defaultAmount);
    setGlobalStartDate(TODAY);
    setGlobalDiscountId('');
    setGlobalRecurring(false);
    onClose();
  };

  const handleRetryFailed = () => {
    if (!rows.some((r) => r.status === 'error')) return;
    setRows((prev) => prev.map((r) => r.status === 'error' ? { ...r, status: 'idle', errorMessage: undefined } : r));
    setSubmitted(false);
  };

  const successCount = rows.filter((r) => r.status === 'success').length;
  const errorCount = rows.filter((r) => r.status === 'error').length;
  const isPending = bulkRegisterMutation.isPending;

  const selectClass =
    'h-8 w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Register Members</DialogTitle>
          <DialogDescription className="flex items-start gap-1.5">
            <span>Use the toolbar to set defaults for all rows at once, then adjust individually as needed.</span>
            <span title="Apply to All: Set a value in the toolbar (plan, date, discount, or payment plan), then click 'Apply to All' to fill all rows with that value. You can still modify individual rows afterward.">
              <HelpCircle className="h-4 w-4 text-gray-400 cursor-help flex-shrink-0 mt-0.5" />
            </span>
          </DialogDescription>
        </DialogHeader>

        {planTypesData && planTypesData.filter((pt) => pt.is_active).length === 0 && (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
            <p className="text-sm text-yellow-800">
              <strong>No plan types configured.</strong> Please go to Settings → Plans to configure your membership plan types before adding members.
            </p>
          </div>
        )}

        {/* Summary bar */}
        {submitted && (
          <div className="flex items-center gap-4 rounded-lg border bg-gray-50 px-4 py-3 text-sm">
            <span className="font-medium">Results:</span>
            {successCount > 0 && (
              <span className="inline-flex items-center gap-1 text-green-700">
                <CheckCircle className="h-4 w-4" /> {successCount} registered
              </span>
            )}
            {errorCount > 0 && (
              <span className="inline-flex items-center gap-1 text-red-700">
                <XCircle className="h-4 w-4" /> {errorCount} failed
              </span>
            )}
            {errorCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleRetryFailed}>
                Retry Failed
              </Button>
            )}
          </div>
        )}

        {/* Apply-to-all toolbar */}
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3 rounded-lg border bg-gray-50 px-4 py-3">
          {/* Plan section */}
          <div className="flex items-end gap-2">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Plan Type</label>
              <select
                value={globalPlanType}
                onChange={(e) => {
                  setGlobalPlanType(e.target.value as BulkRow['planType']);
                }}
                disabled={isPending}
                className="h-8 rounded-md border border-input bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 w-[140px]"
              >
                {planTypesData
                  ?.filter((pt) => pt.is_active)
                  .map((planType) => (
                    <option key={planType.id} value={planType.plan_type}>
                      {planType.plan_type.charAt(0).toUpperCase() + planType.plan_type.slice(1).replace('-', ' ')}
                      {planType.default_amount > 0 && ` (${planType.default_amount})`}
                    </option>
                  ))}
                {(!planTypesData || planTypesData.filter((pt) => pt.is_active).length === 0) && (
                  <option value="" disabled>
                    No plans
                  </option>
                )}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Amount (Rs.)</label>
              <Input
                type="number"
                value={globalPlanAmount}
                onChange={(e) => setGlobalPlanAmount(parseFloat(e.target.value) || 0)}
                className="h-8 text-sm w-[110px]"
                disabled={isPending}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Start Date</label>
              <Input
                type="date"
                value={globalStartDate}
                onChange={(e) => setGlobalStartDate(e.target.value)}
                className="h-8 text-sm w-[140px]"
                disabled={isPending}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleApplyPlanToAll}
              disabled={isPending}
              className="h-8"
            >
              Apply to All
            </Button>
          </div>

          <div className="w-px h-8 bg-gray-300 self-end" />

          {/* Discount section */}
          <div className="flex items-end gap-2">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Discount</label>
              <select
                value={globalDiscountId}
                onChange={(e) => setGlobalDiscountId(e.target.value)}
                disabled={isPending}
                className="h-8 rounded-md border border-input bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 min-w-[170px]"
              >
                <option value="">No Discount</option>
                {discountsData?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.discount_name} ({d.discount_percentage}%)
                  </option>
                ))}
              </select>
            </div>
            {globalDiscountId && (
              <label className="flex items-center gap-1 text-xs text-gray-600 pb-1">
                <input
                  type="checkbox"
                  checked={globalRecurring}
                  onChange={(e) => setGlobalRecurring(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                Recurring
              </label>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleApplyDiscountToAll}
              disabled={isPending}
              className="h-8"
            >
              Apply to All
            </Button>
          </div>

        </div>

        {/* Scrollable table */}
        <div className="flex-1 overflow-auto border rounded-lg">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-3 text-left font-medium text-gray-500 w-8">#</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500 min-w-[160px]">
                  Name <span className="text-red-500">*</span>
                </th>
                <th className="px-3 py-3 text-left font-medium text-gray-500 min-w-[140px]">
                  WhatsApp <span className="text-red-500">*</span>
                </th>
                <th className="px-3 py-3 text-left font-medium text-gray-500 w-[120px]">Plan</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500 w-[110px]">Amount (Rs.)</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500 w-[140px]">Start Date</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500 min-w-[180px]">Discount</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500 w-[80px]">Status</th>
                <th className="px-3 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const discountPct = getRowDiscountPct(row);
                const discountedAmount = computeDiscountedAmount(row.planAmount, discountPct);

                return (
                  <tr
                    key={row.id}
                    className={`border-b transition-colors ${
                      row.status === 'success'
                        ? 'bg-green-50'
                        : row.status === 'error'
                        ? 'bg-red-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-3 py-2 text-gray-400 text-xs">{index + 1}</td>

                    <td className="px-3 py-2">
                      <Input
                        value={row.name}
                        onChange={(e) => handleRowChange(row.id, 'name', e.target.value)}
                        placeholder="Member name"
                        className="h-8 text-sm"
                        disabled={row.status === 'success' || isPending}
                      />
                    </td>

                    <td className="px-3 py-2">
                      <Input
                        value={row.phoneNumber}
                        onChange={(e) => handleRowChange(row.id, 'phoneNumber', e.target.value)}
                        placeholder="0771234567"
                        className="h-8 text-sm"
                        disabled={row.status === 'success' || isPending}
                      />
                    </td>

                    <td className="px-3 py-2">
                      <select
                        value={row.planType}
                        onChange={(e) => handleRowChange(row.id, 'planType', e.target.value)}
                        disabled={row.status === 'success' || isPending}
                        className={selectClass}
                      >
                        {planTypesData
                          ?.filter((pt) => pt.is_active)
                          .map((planType) => (
                            <option key={planType.id} value={planType.plan_type}>
                              {planType.plan_type.charAt(0).toUpperCase() + planType.plan_type.slice(1).replace('-', ' ')}
                            </option>
                          ))}
                        {(!planTypesData || planTypesData.filter((pt) => pt.is_active).length === 0) && (
                          <option value="" disabled>
                            No plans
                          </option>
                        )}
                      </select>
                    </td>

                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        value={row.planAmount}
                        onChange={(e) => handleRowChange(row.id, 'planAmount', parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                        disabled={row.status === 'success' || isPending}
                      />
                    </td>

                    <td className="px-3 py-2">
                      <Input
                        type="date"
                        value={row.membershipStartDate}
                        onChange={(e) => handleRowChange(row.id, 'membershipStartDate', e.target.value)}
                        className="h-8 text-sm"
                        disabled={row.status === 'success' || isPending}
                      />
                    </td>

                    {/* Discount */}
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <select
                          value={row.discountId ?? ''}
                          onChange={(e) =>
                            handleRowChange(row.id, 'discountId', e.target.value || null)
                          }
                          disabled={row.status === 'success' || isPending}
                          className={selectClass}
                        >
                          <option value="">No Discount</option>
                          {discountsData?.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.discount_name} ({d.discount_percentage}%)
                            </option>
                          ))}
                        </select>
                        {row.discountId && (
                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-1 text-xs text-gray-600">
                              <input
                                type="checkbox"
                                checked={row.recurringDiscount}
                                onChange={(e) =>
                                  handleRowChange(row.id, 'recurringDiscount', e.target.checked)
                                }
                                disabled={row.status === 'success' || isPending}
                                className="h-3 w-3"
                              />
                              Recurring
                            </label>
                            <span className="text-xs font-medium text-green-700">
                              Rs. {discountedAmount.toFixed(0)}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2">
                      {row.status === 'success' && (
                        <Badge className="border-transparent bg-green-100 text-green-800 text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" /> Done
                        </Badge>
                      )}
                      {row.status === 'error' && (
                        <div>
                          <Badge className="border-transparent bg-red-100 text-red-800 text-xs cursor-help" title={row.errorMessage}>
                            <XCircle className="h-3 w-3 mr-1" /> Error
                          </Badge>
                          {row.errorMessage && (
                            <p className="text-xs text-red-600 mt-0.5 max-w-[80px] truncate" title={row.errorMessage}>
                              {row.errorMessage}
                            </p>
                          )}
                        </div>
                      )}
                      {row.status === 'idle' && (() => {
                        const validationError = validateRow(row);
                        const hasContent = row.name.trim() || row.phoneNumber.trim();

                        if (!hasContent) {
                          return <span className="text-xs text-gray-400">—</span>;
                        }

                        if (validationError) {
                          return (
                            <Badge className="border-transparent bg-red-100 text-red-800 text-xs cursor-help" title={validationError}>
                              <XCircle className="h-3 w-3 mr-1" /> Invalid
                            </Badge>
                          );
                        }

                        return (
                          <Badge className="border-transparent bg-green-100 text-green-800 text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" /> Valid
                          </Badge>
                        );
                      })()}
                    </td>

                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(row.id)}
                        disabled={rows.length <= 1 || row.status === 'success' || isPending}
                        className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div ref={tableEndRef} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRow}
              disabled={isPending}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Row
            </Button>
            <span className="text-xs text-gray-500">
              {validRows.length} of {rows.length} rows valid
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              {submitted && errorCount === 0 ? 'Close' : 'Cancel'}
            </Button>
            <Button
              type="button"
              onClick={handleRegisterAll}
              disabled={
                !hasAnyFilledRow ||
                isPending ||
                (submitted && errorCount === 0 && successCount > 0) ||
                !planTypesData ||
                planTypesData.filter((pt) => pt.is_active).length === 0
              }
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isPending
                ? 'Registering...'
                : submitted && errorCount > 0
                ? `Retry ${errorCount} Failed`
                : `Register All (${validRows.length})`}
            </Button>
          </div>
        </div>

        {!submitted && (
          <p className="text-xs text-gray-400 text-center">
            Fields marked <span className="text-red-500">*</span> are required.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
