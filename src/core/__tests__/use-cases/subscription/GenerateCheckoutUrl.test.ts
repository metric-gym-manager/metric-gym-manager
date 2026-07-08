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
  const PRICE = 2990;

  function build() {
    const subRepo = mockSubscriptionRepo();
    const intentRepo = mockIntentRepo();
    const gateway = mockPaymentGateway();
    const useCase = new GenerateCheckoutUrl(subRepo, intentRepo, gateway, { [SaasTier.Growth]: PRICE, [SaasTier.Enterprise]: 6990 });
    return { subRepo, intentRepo, gateway, useCase };
  }

  it('creates a pending intent and returns the gateway redirect for a Free gym', async () => {
    const { subRepo, intentRepo, gateway, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(makeSubscription());
    intentRepo.createPending.mockImplementation(async (i) => makeIntent(i));

    const out = await useCase.execute({ targetTier: SaasTier.Growth, gymId: 'gym-1', customer });

    expect(intentRepo.createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        gymId: 'gym-1',
        targetTier: SaasTier.Growth,
        expectedAmount: PRICE,
        currency: 'LKR',
      })
    );
    expect(gateway.buildCheckoutRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ amount: PRICE, gymId: 'gym-1', currency: 'LKR' })
    );
    expect(out.checkoutUrl).toContain('payhere');
    expect(out.orderId).toMatch(/^SUB-gym-1-\d+$/);
  });

  it('allows re-subscription from pro/canceled', async () => {
    const { subRepo, intentRepo, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(
      makeSubscription({ tier: SaasTier.Growth, status: SaasStatus.Canceled })
    );
    intentRepo.createPending.mockImplementation(async (i) => makeIntent(i));

    await expect(useCase.execute({ targetTier: SaasTier.Growth, gymId: 'gym-1', customer })).resolves.toBeDefined();
  });

  it.each([
    ['pro/active', SaasStatus.Active],
    ['pro/past_due (recovery goes via PayHere retry, not a second checkout)', SaasStatus.PastDue],
  ])('rejects %s with ConflictError', async (_label, status) => {
    const { subRepo, intentRepo, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(makeSubscription({ tier: SaasTier.Growth, status }));

    await expect(useCase.execute({ targetTier: SaasTier.Growth, gymId: 'gym-1', customer })).rejects.toThrow(ConflictError);
    expect(intentRepo.createPending).not.toHaveBeenCalled();
  });

  it('propagates the concurrent-intent ConflictError from the repository', async () => {
    const { subRepo, intentRepo, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(makeSubscription());
    intentRepo.createPending.mockRejectedValue(
      new ConflictError('A checkout is already in progress for this gym')
    );

    await expect(useCase.execute({ targetTier: SaasTier.Growth, gymId: 'gym-1', customer })).rejects.toThrow(ConflictError);
  });

  it('throws NotFoundError for an unknown gym', async () => {
    const { subRepo, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(null);

    await expect(useCase.execute({ targetTier: SaasTier.Growth, gymId: 'nope', customer })).rejects.toThrow(NotFoundError);
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
      useCase.execute({ targetTier: SaasTier.Growth, gymId: 'gym-1', customer })
    ).rejects.toThrow(ConflictError);
    expect(intentRepo.createPending).not.toHaveBeenCalled();
  });

  it('prices an Enterprise checkout server-side (6990) and stamps the intent tier', async () => {
    const { subRepo, intentRepo, gateway, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(makeSubscription());
    intentRepo.createPending.mockImplementation(async (i) => makeIntent(i));

    await useCase.execute({ targetTier: SaasTier.Enterprise, gymId: 'gym-1', customer });

    expect(intentRepo.createPending).toHaveBeenCalledWith(
      expect.objectContaining({ targetTier: SaasTier.Enterprise, expectedAmount: 6990 })
    );
    expect(gateway.buildCheckoutRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 6990, tier: SaasTier.Enterprise })
    );
  });
});
