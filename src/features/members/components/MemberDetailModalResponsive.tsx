'use client';

import { useSyncExternalStore } from 'react';
import MemberDetailModal from './MemberDetailModal';
import MemberDetailModalMobile from './MemberDetailModalMobile';
import type { MemberWithDiscount, Payment } from '@/features/members/types';

interface MemberDetailModalResponsiveProps {
  open: boolean;
  onClose: () => void;
  member: MemberWithDiscount | null;
  payments?: Payment[];
  onEditClick: () => void;
}

// Viewport as an external store: no setState-in-effect and no hydration
// mismatch — the server snapshot (null) renders nothing, exactly like the
// old isClient guard did.
function subscribeToResize(callback: () => void) {
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
}

const getIsMobileSnapshot = (): boolean | null => window.innerWidth < 768;
const getServerSnapshot = (): boolean | null => null;

/**
 * Responsive wrapper that renders mobile or desktop modal based on screen size.
 * Mobile: < 768px (md breakpoint)
 * Desktop: >= 768px
 */
export default function MemberDetailModalResponsive(props: MemberDetailModalResponsiveProps) {
  const isMobile = useSyncExternalStore(
    subscribeToResize,
    getIsMobileSnapshot,
    getServerSnapshot
  );

  // Prevent hydration mismatch by rendering nothing on server
  if (isMobile === null) {
    return null;
  }

  // Render mobile or desktop modal based on screen size
  if (isMobile) {
    return <MemberDetailModalMobile {...props} />;
  }

  return <MemberDetailModal {...props} />;
}
