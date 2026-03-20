'use client';

import { useState, useEffect } from 'react';
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

/**
 * Responsive wrapper that renders mobile or desktop modal based on screen size.
 * Mobile: < 768px (md breakpoint)
 * Desktop: >= 768px
 */
export default function MemberDetailModalResponsive(props: MemberDetailModalResponsiveProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    // Check if we're on mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Initial check
    checkMobile();

    // Add resize listener
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Prevent hydration mismatch by rendering nothing on server
  if (!isClient) {
    return null;
  }

  // Render mobile or desktop modal based on screen size
  if (isMobile) {
    return <MemberDetailModalMobile {...props} />;
  }

  return <MemberDetailModal {...props} />;
}
