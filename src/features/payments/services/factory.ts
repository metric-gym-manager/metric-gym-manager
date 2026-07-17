/**
 * Payments feature factory
 *
 * Composes the payment use-cases for API routes.
 * Wiring is copied verbatim from the retired DI Container getters
 * (infrastructure/di/Container.ts) so behavior is identical.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { IPaymentRepository } from './IPaymentRepository';
import { SupabasePaymentRepository } from './SupabasePaymentRepository';
import { CollectPayment } from './CollectPayment';
import { IssueDayPass } from './IssueDayPass';
import { createMemberRepository } from '@/features/members/services/factory';
import { createSMSProvider, createSMSRepository } from '@/features/sms/services/factory';

export function createPaymentRepository(supabase: SupabaseClient): IPaymentRepository {
  return new SupabasePaymentRepository(supabase);
}

export function createCollectPayment(supabase: SupabaseClient): CollectPayment {
  return new CollectPayment(
    createMemberRepository(supabase),
    createPaymentRepository(supabase),
    createSMSProvider(),
    createSMSRepository(supabase)
  );
}

export function createIssueDayPass(supabase: SupabaseClient): IssueDayPass {
  return new IssueDayPass(
    createMemberRepository(supabase),
    createPaymentRepository(supabase),
    createSMSProvider(),
    createSMSRepository(supabase)
  );
}
