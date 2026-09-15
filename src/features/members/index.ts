/**
 * Members Feature - Public API
 *
 * This file exports the public API for the members feature module.
 * External code should import from this file, not from internal components directly.
 *
 * Example:
 * ```typescript
 * import { AddMemberModal, MemberDetailModal } from '@/features/members';
 * ```
 */

// ============================================================
// COMPONENTS
// ============================================================

export { default as AddMemberModal } from './components/AddMemberModal'
export { default as BulkAddMemberModal } from './components/BulkAddMemberModal'
// The phone's gate in front of that grid (plan §14). Desktop opens the grid
// directly; a phone gets this sheet first.
export { default as BulkImportGuidanceSheet } from './components/BulkImportGuidanceSheet'
export { default as EditMemberModal } from './components/EditMemberModal'
// One component, both tiers. The `MemberDetailModalResponsive` wrapper and the
// `MemberDetailModalMobile` fork it chose between were deleted in the mobile
// rebuild's Phase 3: the wrapper switched on `window.innerWidth` (banned by
// rule 2.21) and the fork had drifted — no `MarkPaidDialog`, no SMS history,
// no Radix dialog semantics. `Modal placement` expresses the difference now.
export { default as MemberDetailModal } from './components/MemberDetailModal'
export { default as MemberAvatar } from './components/MemberAvatar'
export { default as MemberPhotoSection } from './components/MemberPhotoSection'
export { default as DayPassModal } from './components/DayPassModal'

// ============================================================
// SERVICES
// ============================================================

export {
  uploadMemberPhoto,
  removeMemberPhoto,
  uploadToPresignedUrl,
} from './services/photo-upload'

// Factories (compose use-cases for routes/cron; wiring mirrors the old DI container).
// The domain entity and configs are imported directly:
//   @/features/members/domain/Member, @/features/members/config/*
export {
  createMemberRepository,
  createRegisterMember,
  createVerifyMember,
  createSuspendMember,
  createReactivateMember,
  createCancelMember,
  createUpdateExpiredStatus,
  createCancelOverdueMembers,
  createExpireSuspendedMembers,
} from './services/factory'

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
} from './schemas/member.schemas'

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
} from './types'

// ============================================================
// UTILS
// ============================================================

export { isNewMember, NEW_MEMBER_DAYS } from './utils/isNewMember'
