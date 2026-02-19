'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import MembersTable from '@/components/members/MembersTable';
import AddMemberModal from '@/components/members/AddMemberModal';
import BulkAddMemberModal from '@/components/members/BulkAddMemberModal';
import PaymentCollectionModal from '@/components/members/PaymentCollectionModal';
import { useMemberModal } from '@/contexts/member-modal.context';
import type { MemberWithDiscount, OverdueMember } from '@/features/members/types';

export default function MembersPage() {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Members</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage your gym members and their memberships
          </p>
        </div>
        <div className="flex items-center gap-3">
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
    </div>
  );
}
