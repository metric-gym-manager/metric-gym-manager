/**
 * Subscriptions feature factory (SaaS billing)
 *
 * Composes the billing use-cases for API routes and cron jobs.
 * Wiring is copied verbatim from the retired DI Container getters
 * (infrastructure/di/Container.ts) so behavior is identical — including
 * the per-tier price injection (amount authority) from PayHere config.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { IGymSubscriptionRepository } from './IGymSubscriptionRepository';
import type { ICheckoutIntentRepository } from './ICheckoutIntentRepository';
import type { ISaasPaymentLogRepository } from './ISaasPaymentLogRepository';
import type { IChargeAttemptRepository } from './IChargeAttemptRepository';
import { SupabaseGymSubscriptionRepository } from './SupabaseGymSubscriptionRepository';
import { SupabaseCheckoutIntentRepository } from './SupabaseCheckoutIntentRepository';
import { SupabaseSaasPaymentLogRepository } from './SupabaseSaasPaymentLogRepository';
import { SupabaseChargeAttemptRepository } from './SupabaseChargeAttemptRepository';
import { GenerateCheckoutUrl } from './GenerateCheckoutUrl';
import { HandlePayHereWebhook } from './HandlePayHereWebhook';
import { ProcessDunning } from './ProcessDunning';
import { ProcessTrialExpiry } from './ProcessTrialExpiry';
import { CancelSubscription } from './CancelSubscription';
import { ChangePlan } from './ChangePlan';
import { ChargeDueRenewals } from './ChargeDueRenewals';
import { PayHereGateway } from '@/lib/payhere/PayHereGateway';
import { PayHereSubscriptionGateway } from '@/lib/payhere/PayHereSubscriptionGateway';
import type { IPaymentGateway } from '@/lib/payhere/IPaymentGateway';
import type { ISubscriptionGateway } from '@/lib/payhere/ISubscriptionGateway';
import { getPayhereConfig } from '@/lib/payhere/config';
import { SaasTier } from '@/features/subscriptions/config/SubscriptionConfig';

// ============================================================
// REPOSITORIES
// ============================================================

export function createGymSubscriptionRepository(
  supabase: SupabaseClient
): IGymSubscriptionRepository {
  return new SupabaseGymSubscriptionRepository(supabase);
}

export function createCheckoutIntentRepository(
  supabase: SupabaseClient
): ICheckoutIntentRepository {
  return new SupabaseCheckoutIntentRepository(supabase);
}

export function createSaasPaymentLogRepository(
  supabase: SupabaseClient
): ISaasPaymentLogRepository {
  return new SupabaseSaasPaymentLogRepository(supabase);
}

export function createChargeAttemptRepository(
  supabase: SupabaseClient
): IChargeAttemptRepository {
  return new SupabaseChargeAttemptRepository(supabase);
}

// ============================================================
// GATEWAYS + PRICES
// ============================================================

/** PayHere redirect/form payment gateway */
export function getPayHereGateway(): IPaymentGateway {
  return new PayHereGateway();
}

/** PayHere OAuth REST subscription gateway (cancel / list payments / charge) */
export function getPayHereSubscriptionGateway(): ISubscriptionGateway {
  return new PayHereSubscriptionGateway();
}

/** Per-tier monthly prices from config — the single injection point (amount authority). */
function getTierPricesLkr(): Record<SaasTier, number> {
  const payhere = getPayhereConfig();
  return {
    [SaasTier.Lite]: payhere.litePriceLkr,
    [SaasTier.Pro]: payhere.proPriceLkr,
    [SaasTier.Enterprise]: payhere.enterprisePriceLkr,
  };
}

// ============================================================
// USE CASES
// ============================================================

/** UC-1: all tiers paid; the price map covers every SaasTier. */
export function createGenerateCheckoutUrl(supabase: SupabaseClient): GenerateCheckoutUrl {
  return new GenerateCheckoutUrl(
    createGymSubscriptionRepository(supabase),
    createCheckoutIntentRepository(supabase),
    getPayHereGateway(),
    getTierPricesLkr()
  );
}

/** UC-2 */
export function createHandlePayHereWebhook(supabase: SupabaseClient): HandlePayHereWebhook {
  return new HandlePayHereWebhook(
    createGymSubscriptionRepository(supabase),
    createCheckoutIntentRepository(supabase),
    createSaasPaymentLogRepository(supabase),
    createChargeAttemptRepository(supabase)
  );
}

/** UC-3 */
export function createProcessDunning(supabase: SupabaseClient): ProcessDunning {
  return new ProcessDunning(
    createGymSubscriptionRepository(supabase),
    createCheckoutIntentRepository(supabase)
  );
}

/** UC-4 */
export function createCancelSubscription(supabase: SupabaseClient): CancelSubscription {
  return new CancelSubscription(
    createGymSubscriptionRepository(supabase),
    getPayHereSubscriptionGateway()
  );
}

/** UC-5 */
export function createProcessTrialExpiry(supabase: SupabaseClient): ProcessTrialExpiry {
  return new ProcessTrialExpiry(createGymSubscriptionRepository(supabase));
}

/** UC-6: one-click tier change / reactivation against the stored card token. */
export function createChangePlan(supabase: SupabaseClient): ChangePlan {
  return new ChangePlan(
    createGymSubscriptionRepository(supabase),
    createChargeAttemptRepository(supabase),
    getPayHereSubscriptionGateway(),
    createSaasPaymentLogRepository(supabase),
    getTierPricesLkr()
  );
}

/** UC-7: the token-billing engine (daily charge-renewals cron). */
export function createChargeDueRenewals(supabase: SupabaseClient): ChargeDueRenewals {
  return new ChargeDueRenewals(
    createGymSubscriptionRepository(supabase),
    createChargeAttemptRepository(supabase),
    getPayHereSubscriptionGateway(),
    createSaasPaymentLogRepository(supabase),
    getTierPricesLkr()
  );
}
