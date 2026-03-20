import type { MemberPlanType, MemberStatus } from '../schemas/member.schemas';

// ============================================================
// MEMBER TYPES
// ============================================================

export interface Member {
  id: string;
  gym_id: string;
  name: string;
  phone_number: string;
  plan_type: MemberPlanType;
  plan_amount: number;
  discount_id: string | null;
  recurring_discount: boolean;
  status: MemberStatus;
  registered_date: string;
  membership_start_date: string;
  next_due_date: string;
  created_at: string;
  updated_at: string;
}

export interface MemberWithDiscount extends Member {
  discount?: {
    id: string;
    discount_name: string;
    discount_percentage: number;
  } | null;
}

export interface OverdueMember extends MemberWithDiscount {
  days_overdue: number;
}

// ============================================================
// PAYMENT TYPES
// ============================================================

export interface Payment {
  id: string;
  member_id: string;
  payment_date: string;
  amount_paid: number;
  discount_applied: string | null;
  discount_percentage: number | null;
  next_due_date_calculated: string;
  created_at: string;
}

export interface PaymentWithMember extends Payment {
  member: Member;
}

// ============================================================
// RESPONSE TYPES
// ============================================================

export interface MembersListResponse {
  members: MemberWithDiscount[];
  overdueMembers: OverdueMember[];
  totalCount: number;
  page: number;
  totalPages: number;
}

export interface MemberDetailResponse {
  member: MemberWithDiscount;
  payments: Payment[];
}
