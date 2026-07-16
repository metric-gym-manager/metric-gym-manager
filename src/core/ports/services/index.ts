// Service interfaces.
// ISMSProvider stays here until Phase 5 (-> features/sms).
export {
  type ISMSProvider,
  type ISMSTemplate,
  type SMSMessage,
  type SMSSendResult,
} from '@/features/sms/services/ISMSProvider';

// Gateway interfaces relocated to @/lib/payhere in Phase 4; bridged here for
// the subscription use-cases and DI container until they move in Phase 5.
export {
  type IPaymentGateway,
  type CheckoutCustomer,
  type CheckoutRedirect,
} from '@/lib/payhere/IPaymentGateway';

export {
  type ISubscriptionGateway,
  type GatewaySubscriptionPayment,
  type TokenChargeInput,
  type TokenChargeResult,
} from '@/lib/payhere/ISubscriptionGateway';
