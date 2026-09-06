/**
 * SMS feature factory
 *
 * Composes the SMS feature's services for API routes and cron jobs.
 * Wiring is copied verbatim from the retired DI Container getters
 * (infrastructure/di/Container.ts) so behavior is identical.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ISMSProvider } from './ISMSProvider'
import type { ISMSRepository } from './ISMSRepository'
import { SupabaseSMSRepository } from './SupabaseSMSRepository'
import { TextLkSMSProvider } from './providers/TextLkSMSProvider'
import { MockSMSProvider } from './providers/MockSMSProvider'
import { SendAutomatedReminders } from './SendAutomatedReminders'
import { RecordSmsDeliveryReceipt } from './RecordSmsDeliveryReceipt'
import { SupabaseMemberRepository } from '@/features/members/services/SupabaseMemberRepository'
import { SupabaseGymSubscriptionRepository } from '@/features/subscriptions/services/SupabaseGymSubscriptionRepository'

/**
 * SMS provider: real provider (Text.lk) if ENABLE_REAL_SMS=true,
 * otherwise the mock provider for development.
 */
export function createSMSProvider(): ISMSProvider {
  const useRealSms = process.env.ENABLE_REAL_SMS === 'true'

  if (useRealSms) {
    console.log('📱 Using Text.lk SMS Provider (ENABLE_REAL_SMS=true)')
    return new TextLkSMSProvider()
  }
  console.log('📱 Using Mock SMS Provider (ENABLE_REAL_SMS=false or not set)')
  return new MockSMSProvider()
}

export function createSMSRepository(supabase: SupabaseClient): ISMSRepository {
  return new SupabaseSMSRepository(supabase)
}

/**
 * Member SMS history read model.
 *
 * Pass a **session** client: the read is gym-scoped in the query and RLS is the
 * second lock behind it. This replaces `sms-history.service.ts`, which built its
 * own Supabase query outside the repository and drifted onto a `created_at`
 * column the table does not have.
 */
export function createMemberSmsHistoryReader(
  supabase: SupabaseClient
): ISMSRepository['findHistoryForMember'] {
  const repo = createSMSRepository(supabase)
  return repo.findHistoryForMember.bind(repo)
}

/**
 * SendAutomatedReminders use case (send-reminders cron).
 * Billing-status source: suspended/canceled gyms are skipped.
 */
export function createSendAutomatedReminders(
  supabase: SupabaseClient
): SendAutomatedReminders {
  return new SendAutomatedReminders(
    new SupabaseMemberRepository(supabase),
    createSMSRepository(supabase),
    createSMSProvider(),
    new SupabaseGymSubscriptionRepository(supabase)
  )
}

/**
 * Delivery-receipt use case (text.lk webhook).
 *
 * **Pass `createAdminClient()`.** `sms_logs` carries SELECT and INSERT policies
 * and no UPDATE policy, so a session client's update is refused by RLS — and
 * PostgREST reports no error for an update that matched nothing, which is how
 * the webhook logged success while changing nothing (R7).
 */
export function createRecordSmsDeliveryReceipt(
  supabase: SupabaseClient
): RecordSmsDeliveryReceipt {
  return new RecordSmsDeliveryReceipt(createSMSRepository(supabase))
}
