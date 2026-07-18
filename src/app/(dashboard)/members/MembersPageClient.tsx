'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { MembersTable } from '@/features/members'
import { useMemberModal } from '@/contexts/member-modal.context'
import type { MemberWithDiscount } from '@/features/members/types'

const AddMemberModal = dynamic(
  () =>
    import('@/features/members').then((mod) => ({
      default: mod.AddMemberModal,
    })),
  { ssr: false }
)
const BulkAddMemberModal = dynamic(
  () =>
    import('@/features/members').then((mod) => ({
      default: mod.BulkAddMemberModal,
    })),
  { ssr: false }
)
const DayPassModal = dynamic(
  () =>
    import('@/features/members').then((mod) => ({ default: mod.DayPassModal })),
  { ssr: false }
)

export default function MembersPageClient() {
  const { openMember } = useMemberModal()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [dayPassModalOpen, setDayPassModalOpen] = useState(false)

  // Deep-link support for the command palette's quick actions: /members?action=add
  // opens the Add Member modal (also ?action=bulk / ?action=daypass). The URL is
  // the source of truth for these so no state-syncing effect is needed; closing a
  // deep-linked modal strips the param (via clearActionParam) so refresh/back
  // don't reopen it.
  const action = searchParams.get('action')
  const clearActionParam = () => {
    if (action) router.replace('/members', { scroll: false })
  }

  const handleMemberClick = (member: MemberWithDiscount) => {
    openMember(member.id)
  }

  return (
    <>
      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={() => setDayPassModalOpen(true)}>
          Create Day Pass
        </Button>
        <Button
          variant="outline"
          onClick={() => setBulkModalOpen(true)}
          className="hidden sm:inline-flex"
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
      <MembersTable onMemberClick={handleMemberClick} />

      {/* Add Member Modal — opens from the button or the ?action=add deep link */}
      <AddMemberModal
        open={addModalOpen || action === 'add'}
        onClose={() => {
          setAddModalOpen(false)
          clearActionParam()
        }}
      />

      {/* Bulk Add Member Modal */}
      <BulkAddMemberModal
        open={bulkModalOpen || action === 'bulk'}
        onClose={() => {
          setBulkModalOpen(false)
          clearActionParam()
        }}
      />

      {/* Day Pass Modal */}
      <DayPassModal
        open={dayPassModalOpen || action === 'daypass'}
        onClose={() => {
          setDayPassModalOpen(false)
          clearActionParam()
        }}
      />
    </>
  )
}
