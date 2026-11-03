/**
 * Members feature factory
 *
 * Composes the member use-cases for API routes and cron jobs.
 * Wiring is copied verbatim from the retired DI Container getters
 * (infrastructure/di/Container.ts) so behavior is identical.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { IMemberRepository } from './IMemberRepository';
import { SupabaseMemberRepository } from './SupabaseMemberRepository';
import { RegisterMember } from './RegisterMember';
import { VerifyMember } from './VerifyMember';
import { SuspendMember } from './SuspendMember';
import { UpdateMemberProfile } from './UpdateMemberProfile';
import { ReactivateMember } from './ReactivateMember';
import { CancelMember } from './CancelMember';
import { UpdateExpiredStatus } from './UpdateExpiredStatus';
import { CancelOverdueMembers } from './CancelOverdueMembers';
import { ExpireSuspendedMembers } from './ExpireSuspendedMembers';
import { createSMSProvider, createSMSRepository } from '@/features/sms/services/factory';
import { SupabasePaymentRepository } from '@/features/payments/services/SupabasePaymentRepository';

export function createMemberRepository(supabase: SupabaseClient): IMemberRepository {
  return new SupabaseMemberRepository(supabase);
}

export function createRegisterMember(supabase: SupabaseClient): RegisterMember {
  return new RegisterMember(
    createMemberRepository(supabase),
    new SupabasePaymentRepository(supabase),
    createSMSProvider(),
    createSMSRepository(supabase)
  );
}

export function createVerifyMember(supabase: SupabaseClient): VerifyMember {
  return new VerifyMember(createMemberRepository(supabase));
}

export function createSuspendMember(supabase: SupabaseClient): SuspendMember {
  return new SuspendMember(createMemberRepository(supabase));
}

export function createUpdateMemberProfile(supabase: SupabaseClient): UpdateMemberProfile {
  return new UpdateMemberProfile(createMemberRepository(supabase));
}

export function createReactivateMember(supabase: SupabaseClient): ReactivateMember {
  return new ReactivateMember(createMemberRepository(supabase));
}

export function createCancelMember(supabase: SupabaseClient): CancelMember {
  return new CancelMember(createMemberRepository(supabase));
}

export function createUpdateExpiredStatus(supabase: SupabaseClient): UpdateExpiredStatus {
  return new UpdateExpiredStatus(createMemberRepository(supabase));
}

export function createCancelOverdueMembers(supabase: SupabaseClient): CancelOverdueMembers {
  return new CancelOverdueMembers(createMemberRepository(supabase));
}

export function createExpireSuspendedMembers(supabase: SupabaseClient): ExpireSuspendedMembers {
  return new ExpireSuspendedMembers(createMemberRepository(supabase));
}
