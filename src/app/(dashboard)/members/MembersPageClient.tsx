'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import MembersTable from '@/components/members/MembersTable';
import { useMemberModal } from '@/contexts/member-modal.context';
import type { MemberWithDiscount, OverdueMember } from '@/features/members/types';

const AddMemberModal = dynamic(
  () => import('@/components/members/AddMemberModal'),
  { ssr: false }
);
const BulkAddMemberModal = dynamic(
  () => import('@/components/members/BulkAddMemberModal'),
  { ssr: false }
);
const PaymentCollectionModal = dynamic(
  () => import('@/components/members/PaymentCollectionModal'),
  { ssr: false }
);

export default function MembersPageClient() {
  const { openMember } = useMemberModal();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedOverdueMember, setSelectedOverdueMember] = useState<OverdueMember | null>(null);

  const handleMemberClick = (member: MemberWithDiscount) => {
    openMember(member.id);
  };

  const handlePaymentClick = (member: OverdueMember) => {
    setSelectedOverdueMember(member);
    setPaymentModalOpen(true);
  };

  return (
    <>
      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => setBulkModalOpen(true)}
        >
          Bulk Register
        </Button>
        <Button
          onClick={() => setAddModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          + Add Member
        </Button>
      </div>

      {/* Members Table */}
      <MembersTable
        onMemberClick={handleMemberClick}
        onPaymentClick={handlePaymentClick}
      />

      {/* Add Member Modal */}
      <AddMemberModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      />

      {/* Bulk Add Member Modal */}
      <BulkAddMemberModal
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
      />

      {/* Payment Collection Modal (overdue quick-pay) */}
      <PaymentCollectionModal
        open={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setSelectedOverdueMember(null);
        }}
        member={selectedOverdueMember}
      />
    </>
  );
}
