/**
 * Members Feature - Public API
 *
 * This file exports the public API for the members feature module.
 * External code should import from this file, not from internal components directly.
 *
 * Example:
 * ```typescript
 * import { MembersTable, AddMemberModal } from '@/features/members';
 * ```
 */

// ============================================================
// COMPONENTS
// ============================================================

export { default as AddMemberModal } from './components/AddMemberModal';
export { default as BulkAddMemberModal } from './components/BulkAddMemberModal';
export { default as EditMemberModal } from './components/EditMemberModal';
export { default as MemberDetailModal } from './components/MemberDetailModal';
export { default as MemberDetailModalMobile } from './components/MemberDetailModalMobile';
export { default as MemberDetailModalResponsive } from './components/MemberDetailModalResponsive';
export { default as MembersTable } from './components/MembersTable';
export { default as PaymentCollectionModal } from './components/PaymentCollectionModal';
export { PaymentDetailsModal } from './components/PaymentDetailsModal';

// ============================================================
// SCHEMAS
// ============================================================

export {
  addMemberSchema,
  updateMemberSchema,
  collectPaymentSchema,
  type AddMemberInput,
  type UpdateMemberInput,
  type CollectPaymentInput,
} from './schemas/member.schemas';

// ============================================================
// TYPES
// ============================================================

export type {
  Member,
  MemberWithDiscount,
  OverdueMember,
  Payment,
  PaymentWithMember,
  MembersListResponse,
  MemberDetailResponse,
} from './types';
