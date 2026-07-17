/**
 * Subscriptions feature — public API (architecture §2.4).
 *
 * Only what the app routes/pages and sibling features may import. The
 * feature folder is deletable: external importers are the billing page,
 * the members-feature upsell, and the API routes using the serializer.
 */

// Components
export { default as CurrentPlanCard } from './components/CurrentPlanCard';
export { default as PricingTable } from './components/PricingTable';
export { default as UpgradeConfirmDialog } from './components/UpgradeConfirmDialog';
export { default as ReturnStatusPanel } from './components/ReturnStatusPanel';
export { default as PastDueBanner } from './components/PastDueBanner';
export { default as CancelSubscriptionDialog } from './components/CancelSubscriptionDialog';
export { default as BillingHistoryTable } from './components/BillingHistoryTable';
export { default as QuotaReachedUpsell } from './components/QuotaReachedUpsell';
export { default as ReactivationLimitDialog } from './components/ReactivationLimitDialog';
export { default as ProAvatarRing } from './components/ProAvatarRing';
export { default as MemberLimitBar } from './components/MemberLimitBar';
export { default as FeatureGate } from './components/FeatureGate';
export { default as TrialBanner } from './components/TrialBanner';
export { submitPayHereCheckout } from './components/PayHereRedirectForm';

// Hooks
export { useSubscription, SUBSCRIPTION_QUERY_KEY } from './hooks/useSubscription';
export { usePaymentStatusPoll } from './hooks/usePaymentStatusPoll';
export { useBillingHistory } from './hooks/useBillingHistory';
export { useCheckout } from './hooks/useCheckout';
export { useCancelSubscription } from './hooks/useCancelSubscription';
export { useChangePlan } from './hooks/useChangePlan';

// Serialization (used by API routes)
export { serializeSubscriptionForAPI } from './utils/serializeSubscriptionForAPI';

// Schemas
export {
  checkoutCustomerSchema,
  billingHistoryQuerySchema,
} from './schemas/subscription.schemas';

// Types
export type {
  SerializedSubscription,
  BillingHistoryRow,
  BillingHistoryPage,
  CheckoutRedirectResponse,
  PaymentPollState,
} from './types';

// Factories (compose billing use-cases for routes/cron; wiring mirrors the
// old DI container, including per-tier price injection)
export {
  createGymSubscriptionRepository,
  createCheckoutIntentRepository,
  createSaasPaymentLogRepository,
  createChargeAttemptRepository,
  getPayHereGateway,
  getPayHereSubscriptionGateway,
  createGenerateCheckoutUrl,
  createHandlePayHereWebhook,
  createProcessDunning,
  createCancelSubscription,
  createProcessTrialExpiry,
  createChangePlan,
  createChargeDueRenewals,
} from './services/factory';
