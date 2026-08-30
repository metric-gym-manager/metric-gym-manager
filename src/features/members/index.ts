/**
 * Members Feature - Public API
 *
 * This file exports the public API for the members feature module.
 * External code should import from this file, not from internal components directly.
 *
 * Example:
 * ```typescript
 * import { AddMemberModal, MemberDetailModalResponsive } from '@/features/members';
 * ```
 */

// ============================================================
// COMPONENTS
// ============================================================

export { default as AddMemberModal } from './components/AddMemberModal'
export { default as BulkAddMemberModal } from './components/BulkAddMemberModal'
export { default as EditMemberModal } from './components/EditMemberModal'
// Desktop/mobile variants are internals of the responsive wrapper — not public API
export { default as MemberDetailModalResponsive } from './components/MemberDetailModalResponsive'
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
