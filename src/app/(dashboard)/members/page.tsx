'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import MembersTable from '@/components/members/MembersTable';
import AddMemberModal from '@/components/members/AddMemberModal';
import EditMemberModal from '@/components/members/EditMemberModal';
import MemberDetailModal from '@/components/members/MemberDetailModal';
import PaymentCollectionModal from '@/components/members/PaymentCollectionModal';
import type { MemberWithDiscount, OverdueMember } from '@/features/members/types';

export default function MembersPage() {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberWithDiscount | null>(null);
  const [selectedOverdueMember, setSelectedOverdueMember] = useState<OverdueMember | null>(null);

  // Fetch member details when detail modal is opened
  const { data: memberDetails } = useQuery({
    queryKey: ['member', selectedMember?.id],
    queryFn: async () => {
      if (!selectedMember) return null;
      const response = await fetch(`/api/members/${selectedMember.id}`);
      if (!response.ok) throw new Error('Failed to fetch member details');
      const result = await response.json();
      return result.data;
    },
    enabled: !!selectedMember && detailModalOpen,
  });

  const handleMemberClick = (member: MemberWithDiscount) => {
    setSelectedMember(member);
    setDetailModalOpen(true);
  };

  const handlePaymentClick = (member: OverdueMember) => {
    setSelectedOverdueMember(member);
    setPaymentModalOpen(true);
  };

  const handleEditClick = () => {
    setDetailModalOpen(false);
    setEditModalOpen(true);
    // selectedMember is already set from the detail modal
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
        <Button onClick={() => setAddModalOpen(true)}>
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

      {/* Member Detail Modal */}
      <MemberDetailModal
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedMember(null);
        }}
        member={selectedMember}
        payments={memberDetails?.payments || []}
        onEditClick={handleEditClick}
      />

      {/* Payment Collection Modal */}
      <PaymentCollectionModal
        open={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setSelectedOverdueMember(null);
        }}
        member={selectedOverdueMember}
      />

      {/* Edit Member Modal */}
      <EditMemberModal
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedMember(null);
        }}
        member={selectedMember}
      />
    </div>
  );
}
