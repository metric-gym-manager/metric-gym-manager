import { CancelSubscription } from '@/core/use-cases/subscription/CancelSubscription';
import { SaasTier, SaasStatus } from '@/core/utils/constants/SubscriptionConfig';
import { Subscription } from '@/core/domain/subscription/Subscription';
import { ConflictError, ExternalServiceError, NotFoundError } from '@/core/utils/errors';
import { makeSubscription, mockSubscriptionRepo, mockSubscriptionGateway } from '@/core/test-utils/subscription-mocks';

describe('CancelSubscription (UC-4)', () => {
  function build() {
    const subRepo = mockSubscriptionRepo();
    const gateway = mockSubscriptionGateway();
    const useCase = new CancelSubscription(subRepo, gateway);
    return { subRepo, gateway, useCase };
  }

  const proActive = () =>
    makeSubscription({
      tier: SaasTier.Pro,
      status: SaasStatus.Active,
      payhereSubscriptionId: 'PHSUB-A',
      currentPeriodEnd: new Date('2026-08-01T00:00:00Z'),
    });

  it('cancels gateway-first, then persists pro/canceled', async () => {
    const { subRepo, gateway, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(proActive());

    const callOrder: string[] = [];
    gateway.cancelSubscription.mockImplementation(async () => {
      callOrder.push('gateway');
    });
    subRepo.save.mockImplementation(async (s: Subscription) => {
      callOrder.push('save');
      return s;
    });

    const result = await useCase.execute({ gymId: 'gym-1' });

    expect(callOrder).toEqual(['gateway', 'save']); // gateway BEFORE local write
    expect(gateway.cancelSubscription).toHaveBeenCalledWith('PHSUB-A');
    expect(result.status).toBe(SaasStatus.Canceled);
    expect(result.tier).toBe(SaasTier.Pro); // paid-through until period end
    expect(subRepo.save).toHaveBeenCalledWith(expect.anything(), { extendPeriod: false });
  });

  it('cancels from pro/past_due as well', async () => {
    const { subRepo, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(
      makeSubscription({
        tier: SaasTier.Pro,
        status: SaasStatus.PastDue,
        payhereSubscriptionId: 'PHSUB-A',
      })
    );

    const result = await useCase.execute({ gymId: 'gym-1' });
    expect(result.status).toBe(SaasStatus.Canceled);
  });

  it('is idempotent: already-canceled returns current state without a gateway call', async () => {
    const { subRepo, gateway, useCase } = build();
    const canceled = makeSubscription({
      tier: SaasTier.Pro,
      status: SaasStatus.Canceled,
      payhereSubscriptionId: 'PHSUB-A',
    });
    subRepo.findByGymId.mockResolvedValue(canceled);

    const result = await useCase.execute({ gymId: 'gym-1' });

    expect(result).toBe(canceled);
    expect(gateway.cancelSubscription).not.toHaveBeenCalled();
    expect(subRepo.save).not.toHaveBeenCalled();
  });

  it('leaves local state untouched when the gateway throws', async () => {
    const { subRepo, gateway, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(proActive());
    gateway.cancelSubscription.mockRejectedValue(
      new ExternalServiceError('PayHere', 'IP not whitelisted')
    );

    await expect(useCase.execute({ gymId: 'gym-1' })).rejects.toThrow(ExternalServiceError);
    expect(subRepo.save).not.toHaveBeenCalled();
  });

  it('rejects Free gyms with ConflictError', async () => {
    const { subRepo, gateway, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(makeSubscription());

    await expect(useCase.execute({ gymId: 'gym-1' })).rejects.toThrow(ConflictError);
    expect(gateway.cancelSubscription).not.toHaveBeenCalled();
  });

  it('rejects Pro without a gateway subscription id (data inconsistency)', async () => {
    const { subRepo, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(
      makeSubscription({ tier: SaasTier.Pro, status: SaasStatus.Active })
    );

    await expect(useCase.execute({ gymId: 'gym-1' })).rejects.toThrow(ConflictError);
  });

  it('throws NotFoundError for an unknown gym', async () => {
    const { subRepo, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(null);

    await expect(useCase.execute({ gymId: 'nope' })).rejects.toThrow(NotFoundError);
  });
});
