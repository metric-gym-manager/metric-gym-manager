/**
 * SMS feature factory
 *
 * Composes the SMS feature's services for API routes and cron jobs.
 * Wiring is copied verbatim from the retired DI Container getters
 * (infrastructure/di/Container.ts) so behavior is identical.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ISMSProvider } from './ISMSProvider';
import type { ISMSRepository } from './ISMSRepository';
import { SupabaseSMSRepository } from './SupabaseSMSRepository';
import { TextLkSMSProvider } from './providers/TextLkSMSProvider';
import { MockSMSProvider } from './providers/MockSMSProvider';
import { SendAutomatedReminders } from './SendAutomatedReminders';
import { SupabaseMemberRepository } from '@/infrastructure/database/repositories/SupabaseMemberRepository';
import { SupabaseGymSubscriptionRepository } from '@/infrastructure/database/repositories/SupabaseGymSubscriptionRepository';

/**
 * SMS provider: real provider (Text.lk) if ENABLE_REAL_SMS=true,
 * otherwise the mock provider for development.
 */
export function createSMSProvider(): ISMSProvider {
  const useRealSms = process.env.ENABLE_REAL_SMS === 'true';

  if (useRealSms) {
    console.log('📱 Using Text.lk SMS Provider (ENABLE_REAL_SMS=true)');
    return new TextLkSMSProvider();
  }
  console.log('📱 Using Mock SMS Provider (ENABLE_REAL_SMS=false or not set)');
  return new MockSMSProvider();
}

export function createSMSRepository(supabase: SupabaseClient): ISMSRepository {
  return new SupabaseSMSRepository(supabase);
}

/**
 * SendAutomatedReminders use case (send-reminders cron).
 * Billing-status source: suspended/canceled gyms are skipped.
 */
export function createSendAutomatedReminders(supabase: SupabaseClient): SendAutomatedReminders {
  return new SendAutomatedReminders(
    new SupabaseMemberRepository(supabase),
    createSMSRepository(supabase),
    createSMSProvider(),
    new SupabaseGymSubscriptionRepository(supabase)
  );
}
