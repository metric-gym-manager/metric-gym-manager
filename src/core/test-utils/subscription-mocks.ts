/**
 * Shared mock factories for subscription use-case tests.
 */

import { Subscription, SubscriptionProps } from '@/core/domain/subscription/Subscription';
import { SaasTier, SaasStatus } from '@/core/utils/constants/SubscriptionConfig';
import type {
  IGymSubscriptionRepository,
  ICheckoutIntentRepository,
  ISaasPaymentLogRepository,
  CheckoutIntent,
} from '@/core/ports/repositories';
import type { IPaymentGateway, ISubscriptionGateway } from '@/core/ports/services';

export function makeSubscription(overrides: Partial<SubscriptionProps> = {}): Subscription {
  return Subscription.create({
    gymId: 'gym-1',
    tier: SaasTier.Lite,
    status: SaasStatus.Active,
    memberCount: 0,
    currentPeriodEnd: null,
    trialEndsAt: null,
    payhereCustomerId: null,
    payhereSubscriptionId: null,
    ...overrides,
  });
}

export function makeIntent(overrides: Partial<CheckoutIntent> = {}): CheckoutIntent {
  return {
    orderId: 'SUB-gym-1-1',
    gymId: 'gym-1',
    targetTier: SaasTier.Lite,
    expectedAmount: 2990,
    currency: 'LKR',
    status: 'pending',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    ...overrides,
  };
}

export function mockSubscriptionRepo(): jest.Mocked<IGymSubscriptionRepository> {
  return {
    findByGymId: jest.fn(),
    findByPayhereSubscriptionId: jest.fn(),
    save: jest.fn().mockImplementation(async (sub: Subscription) => sub),
    runDunningSuspensions: jest.fn(),
    runTrialExpiry: jest.fn(),
  };
}

export function mockIntentRepo(): jest.Mocked<ICheckoutIntentRepository> {
  return {
    createPending: jest.fn(),
    findPendingByOrderId: jest.fn().mockResolvedValue(null),
    markStatus: jest.fn(),
    expireStale: jest.fn(),
  };
}

export function mockLogRepo(): jest.Mocked<ISaasPaymentLogRepository> {
  return {
    insertIfNew: jest.fn().mockResolvedValue(true),
    insertInvalid: jest.fn(),
    listFailures: jest.fn(),
    listByGym: jest.fn(),
    findLatestFailure: jest.fn(),
  };
}

export function mockPaymentGateway(): jest.Mocked<IPaymentGateway> {
  return {
    buildCheckoutRedirect: jest.fn().mockReturnValue({
      checkoutUrl: 'https://sandbox.payhere.lk/pay/checkout',
      params: { order_id: 'SUB-gym-1-1' },
    }),
    verifyNotificationSignature: jest.fn().mockReturnValue(true),
  };
}

export function mockSubscriptionGateway(): jest.Mocked<ISubscriptionGateway> {
  return {
    cancelSubscription: jest.fn().mockResolvedValue(undefined),
    listSubscriptionPayments: jest.fn().mockResolvedValue([]),
  };
}
