'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import dynamic from 'next/dynamic'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { MemberWithDiscount, Payment } from '@/features/members/types'

// `ssr: false` because the detail overlay is never part of a first paint —
// it opens from a list — and because `Modal` reads the viewport tier to decide
// whether it is a screen or a dialog.
const MemberDetailModal = dynamic(
  () =>
    import('@/features/members').then((mod) => ({
      default: mod.MemberDetailModal,
    })),
  { ssr: false }
)
const EditMemberModal = dynamic(
  () =>
    import('@/features/members').then((mod) => ({
      default: mod.EditMemberModal,
    })),
  { ssr: false }
)

// Composed in here rather than imported by the members feature, so neither
// feature depends on the other (R2). It renders nothing at all for gyms
// without the Enterprise capability or without hardware set up, so it is safe
// to mount for every gym. Lazily loaded: most gyms never render it.
const MemberAccessPanel = dynamic(
  () => import('@/features/access-control/components/MemberAccessPanel'),
  { ssr: false }
)

interface MemberModalContextValue {
  openMember: (memberId: string) => void
}

const MemberModalContext = createContext<MemberModalContextValue>({
  openMember: () => {},
})

export function useMemberModal() {
  return useContext(MemberModalContext)
}

export function MemberModalProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [memberId, setMemberId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const openMember = useCallback((id: string) => {
    setMemberId(id)
    setDetailOpen(true)
  }, [])

  // Single request: member + payments in parallel on the server
  const { data: detailData } = useQuery<{
    member: MemberWithDiscount
    payments: Payment[]
  } | null>({
    queryKey: ['member-detail', memberId],
    queryFn: async () => {
      const res = await fetch(`/api/members/${memberId}/detail`)
      if (!res.ok) return null
      const r = await res.json()
      return r.data
    },
    enabled: !!memberId && detailOpen,
  })

  const memberData = detailData
    ? { member: detailData.member, payments: detailData.payments }
    : undefined

  const handleDetailClose = useCallback(() => {
    setDetailOpen(false)
    setMemberId(null)
    // Remove stale data so skeleton shows fresh on next open
    if (memberId) {
      queryClient.removeQueries({ queryKey: ['member-detail', memberId] })
    }
  }, [memberId, queryClient])

  const handleEditClick = useCallback(() => {
    setDetailOpen(false)
    setEditOpen(true)
  }, [])

  const handleEditClose = useCallback(() => {
    setEditOpen(false)
    setMemberId(null)
  }, [])

  return (
    <MemberModalContext.Provider value={{ openMember }}>
      {children}

      <MemberDetailModal
        open={detailOpen}
        onClose={handleDetailClose}
        member={memberData?.member ?? null}
        payments={memberData?.payments ?? []}
        onEditClick={handleEditClick}
        accessSlot={
          memberId ? <MemberAccessPanel memberId={memberId} /> : undefined
        }
      />

      <EditMemberModal
        open={editOpen}
        onClose={handleEditClose}
        member={memberData?.member ?? null}
      />
    </MemberModalContext.Provider>
  )
}
