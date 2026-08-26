'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { Panel, StatusBadge, formatLKR, type StatusTone } from '@/components/workspace/primitives';
import { useMemberModal } from '@/contexts/member-modal.context';
import { MemberAvatar } from '@/features/members';
import type { MembersListResponse, MemberWithDiscount } from '@/features/members/types';

const AddMemberModal = dynamic(
  () => import('@/features/members').then((mod) => ({ default: mod.AddMemberModal })),
  { ssr: false }
);
const BulkAddMemberModal = dynamic(
  () => import('@/features/members').then((mod) => ({ default: mod.BulkAddMemberModal })),
  { ssr: false }
);
const DayPassModal = dynamic(
  () => import('@/features/members').then((mod) => ({ default: mod.DayPassModal })),
  { ssr: false }
);

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'cancelled', label: 'Cancelled' },
];

/** Display badge for a member row (mirrors the design: ACTIVE / EXPIRES SOON / EXPIRED). */
function memberBadge(status: string, nextDue: string): { label: string; tone: StatusTone; dueColor: string } {
  if (status === 'active') {
    const days = Math.ceil((new Date(nextDue).getTime() - Date.now()) / 86_400_000);
    if (days >= 0 && days <= 7) {
      return { label: 'EXPIRES SOON', tone: 'warn', dueColor: 'var(--mws-warn)' };
    }
    return { label: 'ACTIVE', tone: 'ok', dueColor: 'var(--mws-t2)' };
  }
  if (status === 'expired') return { label: 'EXPIRED', tone: 'err', dueColor: 'var(--mws-err)' };
  if (status === 'suspended') return { label: 'SUSPENDED', tone: 'warn', dueColor: 'var(--mws-warn)' };
  return { label: 'CANCELLED', tone: 'neutral', dueColor: 'var(--mws-t3)' };
}

const PLAN_LABEL: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  '3-months': '3 Months',
  '6-months': '6 Months',
  annual: 'Annual',
};

export default function MembersPageClient() {
  const { openMember } = useMemberModal();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [dayPassModalOpen, setDayPassModalOpen] = useState(false);

  const [inputValue, setInputValue] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  // Debounce search (setState inside setTimeout is allowed — not synchronous in the effect body).
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(inputValue);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [inputValue]);

  const { data, isLoading, error } = useQuery<MembersListResponse>({
    queryKey: ['members', search, status, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.append('search', search);
      if (status !== 'all') params.append('status', status);
      const response = await fetch(`/api/members?${params}`);
      if (!response.ok) throw new Error('Failed to fetch members');
      const result = await response.json();
      return result.data;
    },
  });

  const members = data?.members ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="mws-h1">
          Members{' '}
          <span className="mws-mono" style={{ fontSize: 12, color: 'var(--mws-t3)', fontWeight: 400 }}>
            {totalCount} records
          </span>
        </h1>
        <div className="flex gap-2 flex-wrap">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search by name or phone"
            className="mws-input"
            style={{ width: 220 }}
          />
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="mws-select">
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button type="button" onClick={() => setDayPassModalOpen(true)} className="mws-btn">Create day pass</button>
          <button type="button" onClick={() => setBulkModalOpen(true)} className="mws-btn">Bulk import</button>
          <button type="button" onClick={() => setAddModalOpen(true)} className="mws-btn mws-btn-primary">Add member</button>
        </div>
      </div>

      {/* Table */}
      <Panel style={{ overflow: 'hidden' }}>
        <div className="mws-table-scroll">
          <table className="mws-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Next due</th>
                <th style={{ textAlign: 'right' }}>Fee (LKR)</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--mws-t3)' }}>Loading members…</td></tr>
              )}
              {error && !isLoading && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--mws-err)' }}>Failed to load members.</td></tr>
              )}
              {!isLoading && !error && members.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--mws-t3)' }}>No members match your search.</td></tr>
              )}
              {members.map((m: MemberWithDiscount) => {
                const b = memberBadge(m.status, m.next_due_date);
                return (
                  <tr key={m.id} className="mws-row-click" onClick={() => openMember(m.id)}>
                    <td>
                      <div className="flex items-center gap-2">
                        <MemberAvatar name={m.name} photoPath={m.photo_path} photoUpdatedAt={m.photo_updated_at} />
                        <span style={{ fontWeight: 500 }}>{m.name}</span>
                      </div>
                    </td>
                    <td className="mws-mono" style={{ fontSize: 12, color: 'var(--mws-t2)' }}>{m.phone_number}</td>
                    <td style={{ color: 'var(--mws-t2)' }}>{PLAN_LABEL[m.plan_type] ?? m.plan_type}</td>
                    <td><StatusBadge tone={b.tone}>{b.label}</StatusBadge></td>
                    <td className="mws-mono" style={{ fontSize: 12, color: 'var(--mws-t3)' }}>{m.membership_start_date}</td>
                    <td className="mws-mono" style={{ fontSize: 12, color: b.dueColor }}>{m.next_due_date}</td>
                    <td className="mws-num">{formatLKR(m.plan_amount, { prefix: false })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between" style={{ padding: '10px 16px', borderTop: '1px solid var(--mws-b1)' }}>
            <span className="mws-mono" style={{ fontSize: 11, color: 'var(--mws-t3)' }}>
              PAGE {page} OF {totalPages}
            </span>
            <div className="flex gap-2">
              <button type="button" className="mws-btn mws-btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
              <button type="button" className="mws-btn mws-btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
            </div>
          </div>
        )}
      </Panel>

      <AddMemberModal open={addModalOpen} onClose={() => setAddModalOpen(false)} />
      <BulkAddMemberModal open={bulkModalOpen} onClose={() => setBulkModalOpen(false)} />
      <DayPassModal open={dayPassModalOpen} onClose={() => setDayPassModalOpen(false)} />
    </div>
  );
}
