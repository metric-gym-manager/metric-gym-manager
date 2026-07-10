import { GenerateCheckoutUrl } from '@/core/use-cases/subscription/GenerateCheckoutUrl';
import { SaasTier, SaasStatus } from '@/core/utils/constants/SubscriptionConfig';
import { ConflictError, NotFoundError } from '@/core/utils/errors';
import {
  makeSubscription,
  makeIntent,
  mockSubscriptionRepo,
  mockIntentRepo,
  mockPaymentGateway,
} from '@/core/test-utils/subscription-mocks';

const customer = {
  firstName: 'Colombo Fitness',
  lastName: 'Gym',
  email: 'owner@example.com',
  phone: '+94771234567',
  address: '1 Main St',
  city: 'Colombo',
};

describe('GenerateCheckoutUrl (UC-1)', () => {
  const LITE_PRICE = 2990;
  const PRO_PRICE = 4990;
  const ENTERPRISE_PRICE = 6990;

  function build() {
    const subRepo = mockSubscriptionRepo();
    const intentRepo = mockIntentRepo();
    const gateway = mockPaymentGateway();
    const useCase = new GenerateCheckoutUrl(subRepo, intentRepo, gateway, {
      [SaasTier.Lite]: LITE_PRICE,
      [SaasTier.Pro]: PRO_PRICE,
      [SaasTier.Enterprise]: ENTERPRISE_PRICE,
    });
    return { subRepo, intentRepo, gateway, useCase };
  }

  it('creates a pending intent and returns the gateway redirect for a trialing gym', async () => {
    const { subRepo, intentRepo, gateway, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(makeSubscription({ status: SaasStatus.Trialing }));
    intentRepo.createPending.mockImplementation(async (i) => makeIntent(i));

    const out = await useCase.execute({ targetTier: SaasTier.Lite, gymId: 'gym-1', customer });

    expect(intentRepo.createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        gymId: 'gym-1',
        targetTier: SaasTier.Lite,
        expectedAmount: LITE_PRICE,
        currency: 'LKR',
      })
    );
    expect(gateway.buildCheckoutRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ amount: LITE_PRICE, gymId: 'gym-1', currency: 'LKR' })
    );
    expect(out.checkoutUrl).toContain('payhere');
    expect(out.orderId).toMatch(/^SUB-gym-1-\d+$/);
  });

  it.each([
    ['suspended (reactivation)', SaasStatus.Suspended],
    ['canceled (re-subscription)', SaasStatus.Canceled],
  ])('allows checkout from %s', async (_label, status) => {
    const { subRepo, intentRepo, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(makeSubscription({ tier: SaasTier.Pro, status }));
    intentRepo.createPending.mockImplementation(async (i) => makeIntent(i));

    await expect(
      useCase.execute({ targetTier: SaasTier.Pro, gymId: 'gym-1', customer })
    ).resolves.toBeDefined();
  });

  it.each([
    ['active', SaasStatus.Active],
    ['past_due (recovery goes via PayHere retry, not a second checkout)', SaasStatus.PastDue],
  ])('rejects %s with ConflictError', async (_label, status) => {
    const { subRepo, intentRepo, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(makeSubscription({ tier: SaasTier.Pro, status }));

    await expect(
      useCase.execute({ targetTier: SaasTier.Pro, gymId: 'gym-1', customer })
    ).rejects.toThrow(ConflictError);
    expect(intentRepo.createPending).not.toHaveBeenCalled();
  });

  it('propagates the concurrent-intent ConflictError from the repository', async () => {
    const { subRepo, intentRepo, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(makeSubscription({ status: SaasStatus.Trialing }));
    intentRepo.createPending.mockRejectedValue(
      new ConflictError('A checkout is already in progress for this gym')
    );

    await expect(
      useCase.execute({ targetTier: SaasTier.Lite, gymId: 'gym-1', customer })
    ).rejects.toThrow(ConflictError);
  });

  it('throws NotFoundError for an unknown gym', async () => {
    const { subRepo, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(null);

    await expect(
      useCase.execute({ targetTier: SaasTier.Lite, gymId: 'nope', customer })
    ).rejects.toThrow(NotFoundError);
  });

  it('rejects complimentary (lifetime) subscriptions with ConflictError', async () => {
    const { subRepo, intentRepo, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(
      makeSubscription({
        tier: SaasTier.Enterprise,
        status: SaasStatus.Active,
        payhereSubscriptionId: null,
        currentPeriodEnd: null,
      })
    );

    await expect(
      useCase.execute({ targetTier: SaasTier.Pro, gymId: 'gym-1', customer })
    ).rejects.toThrow(ConflictError);
    expect(intentRepo.createPending).not.toHaveBeenCalled();
  });

  it.each([
    [SaasTier.Lite, LITE_PRICE],
    [SaasTier.Pro, PRO_PRICE],
    [SaasTier.Enterprise, ENTERPRISE_PRICE],
  ])('prices a %s checkout server-side (%d) and stamps the intent tier', async (tier, price) => {
    const { subRepo, intentRepo, gateway, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(makeSubscription({ status: SaasStatus.Trialing }));
    intentRepo.createPending.mockImplementation(async (i) => makeIntent(i));

    await useCase.execute({ targetTier: tier, gymId: 'gym-1', customer });

    expect(intentRepo.createPending).toHaveBeenCalledWith(
      expect.objectContaining({ targetTier: tier, expectedAmount: price })
    );
    expect(gateway.buildCheckoutRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ amount: price, tier })
    );
  });
});
