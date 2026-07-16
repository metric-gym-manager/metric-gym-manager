import { ChangePlan } from '@/core/use-cases/subscription/ChangePlan';
import { SaasTier, SaasStatus } from '@/core/utils/constants/SubscriptionConfig';
import { Subscription } from '@/core/domain/subscription/Subscription';
import {
  ChargeFailedError,
  ConflictError,
  ExternalServiceError,
  NoSavedCardError,
  NotFoundError,
} from '@/utils/errors';
import {
  makeSubscription,
  mockSubscriptionRepo,
  mockChargeAttemptRepo,
  mockSubscriptionGateway,
  mockLogRepo,
} from '@/core/test-utils/subscription-mocks';

const PRICES = {
  [SaasTier.Lite]: 2990,
  [SaasTier.Pro]: 4990,
  [SaasTier.Enterprise]: 6990,
};

describe('ChangePlan (UC-6)', () => {
  function build() {
    const subRepo = mockSubscriptionRepo();
    const attemptRepo = mockChargeAttemptRepo();
    const gateway = mockSubscriptionGateway();
    const logRepo = mockLogRepo();
    const useCase = new ChangePlan(subRepo, attemptRepo, gateway, logRepo, PRICES);
    return { subRepo, attemptRepo, gateway, logRepo, useCase };
  }

  const activeLiteWithToken = () =>
    makeSubscription({
      tier: SaasTier.Lite,
      status: SaasStatus.Active,
      payhereCustomerId: 'TOKEN-1',
      currentPeriodEnd: new Date('2026-08-15T00:00:00Z'),
    });

  it('active Lite -> Pro: pre-inserts the attempt, charges the token the PRO price, switches in place with credit extension', async () => {
    const { subRepo, attemptRepo, gateway, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(activeLiteWithToken());

    const { subscription, outcome } = await useCase.execute({
      gymId: 'gym-1',
      targetTier: SaasTier.Pro,
    });

    expect(outcome).toBe('applied');
    // Attempt row inserted BEFORE the charge, with the server-side price
    expect(attemptRepo.createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        gymId: 'gym-1',
        kind: 'plan_change',
        targetTier: SaasTier.Pro,
        expectedAmount: 4990,
      })
    );
    expect(gateway.chargeCustomerToken).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 4990, customerToken: 'TOKEN-1', currency: 'LKR' })
    );
    // In-place switch; credit-preserving extension is the save RPC's job
    expect(subscription.tier).toBe(SaasTier.Pro);
    expect(subscription.status).toBe(SaasStatus.Active);
    expect(subRepo.save).toHaveBeenCalledWith(expect.anything(), { extendPeriod: true });
    expect(attemptRepo.markStatus).toHaveBeenCalledWith(
      expect.stringMatching(/^CHG-gym-1-/),
      'succeeded',
      'PAY-TOKEN-1'
    );
  });

  it('trialing with a token converts the trial into the bought tier', async () => {
    const { subRepo, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(
      makeSubscription({ status: SaasStatus.Trialing, payhereCustomerId: 'TOKEN-1' })
    );

    const { subscription } = await useCase.execute({
      gymId: 'gym-1',
      targetTier: SaasTier.Enterprise,
    });
    expect(subscription.tier).toBe(SaasTier.Enterprise);
    expect(subscription.status).toBe(SaasStatus.Active);
  });

  it.each([
    ['suspended', SaasStatus.Suspended],
    ['canceled', SaasStatus.Canceled],
  ])('one-click reactivation from %s activates the bought tier', async (_label, status) => {
    const { subRepo, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(
      makeSubscription({ tier: SaasTier.Pro, status, payhereCustomerId: 'TOKEN-1' })
    );

    const { subscription } = await useCase.execute({ gymId: 'gym-1', targetTier: SaasTier.Pro });
    expect(subscription.status).toBe(SaasStatus.Active);
    expect(subscription.tier).toBe(SaasTier.Pro);
  });

  it('declined charge: attempt marked failed, plan untouched, CHARGE_FAILED thrown', async () => {
    const { subRepo, attemptRepo, gateway, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(activeLiteWithToken());
    gateway.chargeCustomerToken.mockResolvedValue({
      paymentId: 'PAY-X',
      statusCode: -2,
      statusMessage: 'Insufficient funds',
      signatureValid: true,
      rawPayload: {},
    });

    await expect(
      useCase.execute({ gymId: 'gym-1', targetTier: SaasTier.Pro })
    ).rejects.toThrow(ChargeFailedError);
    expect(subRepo.save).not.toHaveBeenCalled();
    expect(attemptRepo.markStatus).toHaveBeenCalledWith(expect.any(String), 'failed', 'PAY-X');
  });

  it('gateway-pending / unverifiable success: attempt stays pending, no state change, outcome pending_confirmation', async () => {
    const { subRepo, attemptRepo, gateway, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(activeLiteWithToken());
    gateway.chargeCustomerToken.mockResolvedValue({
      paymentId: 'PAY-P',
      statusCode: 2,
      statusMessage: null,
      signatureValid: false, // success we cannot verify
      rawPayload: {},
    });

    const { outcome } = await useCase.execute({ gymId: 'gym-1', targetTier: SaasTier.Pro });
    expect(outcome).toBe('pending_confirmation');
    expect(subRepo.save).not.toHaveBeenCalled();
    expect(attemptRepo.markStatus).not.toHaveBeenCalled(); // webhook finalizes
  });

  it('transport fault: attempt stays pending and the error propagates (webhook/TTL resolves)', async () => {
    const { subRepo, attemptRepo, gateway, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(activeLiteWithToken());
    gateway.chargeCustomerToken.mockRejectedValue(
      new ExternalServiceError('PayHere', 'timeout (outcome unknown)')
    );

    await expect(
      useCase.execute({ gymId: 'gym-1', targetTier: SaasTier.Pro })
    ).rejects.toThrow(ExternalServiceError);
    expect(attemptRepo.markStatus).not.toHaveBeenCalled();
    expect(subRepo.save).not.toHaveBeenCalled();
  });

  it('concurrent charge: the one-pending-per-gym ConflictError propagates and nothing is charged', async () => {
    const { subRepo, attemptRepo, gateway, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(activeLiteWithToken());
    attemptRepo.createPending.mockRejectedValue(
      new ConflictError('A charge is already in progress for this gym')
    );

    await expect(
      useCase.execute({ gymId: 'gym-1', targetTier: SaasTier.Pro })
    ).rejects.toThrow(ConflictError);
    expect(gateway.chargeCustomerToken).not.toHaveBeenCalled();
  });

  it.each([
    [
      'no saved card',
      makeSubscription({ status: SaasStatus.Active, currentPeriodEnd: new Date('2099-01-01') , payhereSubscriptionId: 'PHSUB-LEGACY' }),
      NoSavedCardError,
    ],
    [
      'same tier while active',
      makeSubscription({
        tier: SaasTier.Pro,
        status: SaasStatus.Active,
        payhereCustomerId: 'TOKEN-1',
        currentPeriodEnd: new Date('2099-01-01'),
      }),
      ConflictError,
    ],
    [
      'past_due (retry pipeline owns recovery)',
      makeSubscription({ status: SaasStatus.PastDue, payhereCustomerId: 'TOKEN-1' }),
      ConflictError,
    ],
    [
      'complimentary (platform-managed)',
      makeSubscription({
        tier: SaasTier.Enterprise,
        status: SaasStatus.Active,
        payhereCustomerId: null,
        payhereSubscriptionId: null,
        currentPeriodEnd: null,
      }),
      ConflictError,
    ],
  ])('rejects %s before any money moves', async (_label, sub, expected) => {
    const { subRepo, attemptRepo, gateway, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(sub as Subscription);

    await expect(
      useCase.execute({ gymId: 'gym-1', targetTier: SaasTier.Pro })
    ).rejects.toThrow(expected);
    expect(attemptRepo.createPending).not.toHaveBeenCalled();
    expect(gateway.chargeCustomerToken).not.toHaveBeenCalled();
  });

  it('throws NotFoundError for an unknown gym', async () => {
    const { subRepo, useCase } = build();
    subRepo.findByGymId.mockResolvedValue(null);
    await expect(
      useCase.execute({ gymId: 'nope', targetTier: SaasTier.Pro })
    ).rejects.toThrow(NotFoundError);
  });
});
