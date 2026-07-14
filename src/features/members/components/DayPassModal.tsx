'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Ticket } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import MemberAvatar from './MemberAvatar';
import { formatDate } from '@/lib/utils/date';
import { getPlanBadgeColor } from '@/lib/utils/badge-colors';
import type { MemberWithDiscount } from '@/features/members/types';
import type { PlanType } from '@/features/settings/types';

interface DayPassModalProps {
  open: boolean;
  onClose: () => void;
}

interface MembersSearchResponse {
  members: MemberWithDiscount[];
}

/** True when next_due_date is today or earlier (eligible for a day pass) */
function membershipPeriodEnded(member: MemberWithDiscount): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(member.next_due_date);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate <= today;
}

/**
 * Create Day Pass modal.
 *
 * Search an existing member whose membership has lapsed, take the daily fee
 * in cash, and record it as a day pass (payments row, access until
 * tomorrow). Members still inside their membership period are blocked —
 * they don't need a day pass. Suspended/cancelled members must be
 * reactivated through their own flows.
 */
export default function DayPassModal({ open, onClose }: DayPassModalProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<MemberWithDiscount | null>(null);
  const [amount, setAmount] = useState<string>('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset state when the modal closes
  useEffect(() => {
    if (!open) {
      setSearch('');
      setDebouncedSearch('');
      setSelected(null);
      setAmount('');
    }
  }, [open]);

  // Gym plan defaults — prefill the fee from the daily plan
  const { data: planTypes } = useQuery<PlanType[]>({
    queryKey: ['billing-setup-plan-types'],
    queryFn: async () => {
      const response = await fetch('/api/billing-setup/plans');
      if (!response.ok) return [];
      const result = await response.json();
      return result.data ?? [];
    },
    staleTime: 300000,
    enabled: open,
  });

  const dailyPlan = useMemo(
    () => planTypes?.find((plan) => plan.plan_type === 'daily' && plan.is_active),
    [planTypes]
  );

  // Prefill amount from the gym's daily plan when a member is selected
  useEffect(() => {
    if (selected && dailyPlan && !amount) {
      setAmount(String(dailyPlan.default_amount));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prefill only on selection
  }, [selected, dailyPlan]);

  const { data: searchResults, isFetching: searching } = useQuery<MemberWithDiscount[]>({
    queryKey: ['day-pass-search', debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: debouncedSearch,
        page: '1',
        limit: '8',
      });
      const response = await fetch(`/api/members?${params}`);
      if (!response.ok) return [];
      const result = await response.json();
      return (result.data as MembersSearchResponse)?.members ?? [];
    },
    enabled: open && debouncedSearch.trim().length >= 1 && !selected,
  });

  const dayPassMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('No member selected');
      const response = await fetch(`/api/members/${selected.id}/day-pass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount) }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        const message =
          result?.error?.message ||
          Object.values(result?.error?.details?.errors ?? {}).flat()[0] ||
          'Failed to issue day pass';
        throw new Error(String(message));
      }
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['member-detail', selected?.id] });
      toast.success(
        `Day pass issued — valid until ${formatDate(data.nextDueDate)}`
      );
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to issue day pass');
    },
  });

  const eligible = selected
    ? membershipPeriodEnded(selected) &&
      selected.status !== 'suspended' &&
      selected.status !== 'cancelled'
    : false;

  const ineligibleReason = !selected
    ? null
    : selected.status === 'suspended' || selected.status === 'cancelled'
      ? `This member is ${selected.status} — reactivate them from their profile instead.`
      : !membershipPeriodEnded(selected)
        ? `This member is active until ${formatDate(selected.next_due_date)} — no day pass needed.`
        : null;

  const amountValid = Number(amount) > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" /> Create Day Pass
          </DialogTitle>
          <DialogDescription>
            For members whose membership has expired but who visit for a
            single day. Collect the daily fee and record it here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Member search */}
          {!selected ? (
            <div className="space-y-2">
              <Label htmlFor="day-pass-search">Search Member</Label>
              <Input
                id="day-pass-search"
                placeholder="Search by name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />

              {searching && (
                <p className="text-xs text-gray-400">Searching...</p>
              )}

              {searchResults && searchResults.length > 0 && (
                <ul className="rounded-lg border divide-y max-h-64 overflow-auto">
                  {searchResults.map((member) => (
                    <li key={member.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2.5 flex items-center gap-3 text-left hover:bg-gray-50"
                        onClick={() => setSelected(member)}
                      >
                        <MemberAvatar
                          name={member.name}
                          photoPath={member.photo_path}
                          photoUpdatedAt={member.photo_updated_at}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium truncate">
                            {member.name}
                          </span>
                          <span className="block text-xs text-gray-500">
                            {member.phone_number} · due {formatDate(member.next_due_date)}
                          </span>
                        </span>
                        <Badge className={getPlanBadgeColor(member.plan_type)}>
                          {member.plan_type}
                        </Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {searchResults &&
                searchResults.length === 0 &&
                debouncedSearch.trim().length >= 1 &&
                !searching && (
                  <p className="text-xs text-gray-500">No members found</p>
                )}
            </div>
          ) : (
            <>
              {/* Selected member card */}
              <div className="rounded-lg border p-4 flex items-center gap-4">
                <MemberAvatar
                  name={selected.name}
                  photoPath={selected.photo_path}
                  photoUpdatedAt={selected.photo_updated_at}
                  className="h-14 w-14 text-lg"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{selected.name}</p>
                  <p className="text-xs text-gray-500">{selected.phone_number}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Status: <span className="font-medium">{selected.status}</span>
                    {' · '}Due: {formatDate(selected.next_due_date)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelected(null);
                    setAmount('');
                  }}
                >
                  Change
                </Button>
              </div>

              {ineligibleReason ? (
                <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {ineligibleReason}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="day-pass-amount">Day Pass Fee (LKR)</Label>
                  <Input
                    id="day-pass-amount"
                    type="number"
                    min="1"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={
                      dailyPlan ? String(dailyPlan.default_amount) : 'Enter amount'
                    }
                  />
                  {!dailyPlan && (
                    <p className="text-xs text-gray-400">
                      Tip: set a Daily plan in Billing Setup to prefill this amount.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!selected || !eligible || !amountValid || dayPassMutation.isPending}
              onClick={() => dayPassMutation.mutate()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {dayPassMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              )}
              {dayPassMutation.isPending
                ? 'Issuing...'
                : amountValid
                  ? `Collect Rs. ${Number(amount).toLocaleString('en-LK')} & Issue`
                  : 'Issue Day Pass'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
