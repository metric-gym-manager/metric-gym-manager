'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { MemberWithDiscount, Payment } from '@/features/members/types';

const MemberDetailModal = dynamic(
  () => import('@/components/members/MemberDetailModal'),
  { ssr: false }
);
const EditMemberModal = dynamic(
  () => import('@/components/members/EditMemberModal'),
  { ssr: false }
);

interface InstallmentPayment {
  id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: 'pending' | 'paid' | 'overdue';
}

interface MemberInstallment {
  id: string;
  template_name: string;
  total_amount: number;
  installment_count: number;
  amount_per_installment: number;
  installments_paid: number;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  installment_payments: InstallmentPayment[];
}

interface MemberModalContextValue {
  openMember: (memberId: string) => void;
}

const MemberModalContext = createContext<MemberModalContextValue>({
  openMember: () => {},
});

export function useMemberModal() {
  return useContext(MemberModalContext);
}

export function MemberModalProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const openMember = useCallback((id: string) => {
    setMemberId(id);
    setDetailOpen(true);
  }, []);

  // Single request: member + payments + installments in parallel on the server
  const { data: detailData } = useQuery<{
    member: MemberWithDiscount;
    payments: Payment[];
    installments: MemberInstallment[];
  } | null>({
    queryKey: ['member-detail', memberId],
    queryFn: async () => {
      const res = await fetch(`/api/members/${memberId}/detail`);
      if (!res.ok) return null;
      const r = await res.json();
      return r.data;
    },
    enabled: !!memberId && detailOpen,
  });

  const memberData = detailData ? { member: detailData.member, payments: detailData.payments } : undefined;
  const installmentsData = detailData?.installments;

  const handleDetailClose = useCallback(() => {
    setDetailOpen(false);
    setMemberId(null);
    // Remove stale data so skeleton shows fresh on next open
    if (memberId) {
      queryClient.removeQueries({ queryKey: ['member-detail', memberId] });
    }
  }, [memberId, queryClient]);

  const handleEditClick = useCallback(() => {
    setDetailOpen(false);
    setEditOpen(true);
  }, []);

  const handleEditClose = useCallback(() => {
    setEditOpen(false);
    setMemberId(null);
  }, []);

  return (
    <MemberModalContext.Provider value={{ openMember }}>
      {children}

      <MemberDetailModal
        open={detailOpen}
        onClose={handleDetailClose}
        member={memberData?.member ?? null}
        payments={memberData?.payments ?? []}
        installments={installmentsData ?? []}
        onEditClick={handleEditClick}
      />

      <EditMemberModal
        open={editOpen}
        onClose={handleEditClose}
        member={memberData?.member ?? null}
      />
    </MemberModalContext.Provider>
  );
}
