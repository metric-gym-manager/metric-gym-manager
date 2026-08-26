'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import MemberDetailModal from './MemberDetailModal'
import MemberDetailModalMobile from './MemberDetailModalMobile'
import type { MemberWithDiscount, Payment } from '@/features/members/types'

interface MemberDetailModalResponsiveProps {
  open: boolean
  onClose: () => void
  member: MemberWithDiscount | null
  payments?: Payment[]
  onEditClick: () => void
  /**
   * Optional door-access panel, injected by the caller.
   *
   * A slot rather than an import so the members feature stays deletable
   * without breaking access control, and vice versa (R2). Members knows only
   * that something may render here; it never learns what access control is.
   */
  accessSlot?: ReactNode
}

// Viewport as an external store: no setState-in-effect and no hydration
// mismatch — the server snapshot (null) renders nothing, exactly like the
// old isClient guard did.
function subscribeToResize(callback: () => void) {
  window.addEventListener('resize', callback)
  return () => window.removeEventListener('resize', callback)
}

const getIsMobileSnapshot = (): boolean | null => window.innerWidth < 768
const getServerSnapshot = (): boolean | null => null

/**
 * Responsive wrapper that renders mobile or desktop modal based on screen size.
 * Mobile: < 768px (md breakpoint)
 * Desktop: >= 768px
 */
export default function MemberDetailModalResponsive(
  props: MemberDetailModalResponsiveProps
) {
  const isMobile = useSyncExternalStore(
    subscribeToResize,
    getIsMobileSnapshot,
    getServerSnapshot
  )

  // Prevent hydration mismatch by rendering nothing on server
  if (isMobile === null) {
    return null
  }

  // Render mobile or desktop modal based on screen size. Both accept the same
  // props, `accessSlot` included, so the panel appears on either.
  if (isMobile) {
    return <MemberDetailModalMobile {...props} />
  }

  return <MemberDetailModal {...props} />
}
