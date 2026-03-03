'use client';

import { useState, useEffect } from 'react';
import MemberDetailModal from './MemberDetailModal';
import MemberDetailModalMobile from './MemberDetailModalMobile';
import type { MemberWithDiscount, Payment } from '@/features/members/types';

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

interface MemberDetailModalResponsiveProps {
  open: boolean;
  onClose: () => void;
  member: MemberWithDiscount | null;
  payments?: Payment[];
  installments?: MemberInstallment[];
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
