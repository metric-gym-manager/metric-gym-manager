import { ChargeDueRenewals } from '@/core/use-cases/subscription/ChargeDueRenewals';
import { SaasTier, SaasStatus } from '@/core/utils/constants/SubscriptionConfig';
import { Subscription } from '@/core/domain/subscription/Subscription';
import { ConflictError, ExternalServiceError } from '@/core/utils/errors';
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

const NOW = new Date('2026-08-15T00:35:00Z');

describe('ChargeDueRenewals (UC-7, the token-billing engine)', () => {
  function build(due: Subscription[]) {
    const subRepo = mockSubscriptionRepo();
    const attemptRepo = mockChargeAttemptRepo();
    const gateway = mockSubscriptionGateway();
    const logRepo = mockLogRepo();
    subRepo.findDueForCharge.mockResolvedValue(due);
    const useCase = new ChargeDueRenewals(subRepo, attemptRepo, gateway, logRepo, PRICES);
    return { subRepo, attemptRepo, gateway, logRepo, useCase };
  }

  const dueGym = (overrides = {}) =>
    makeSubscription({
      gymId: 'gym-1',
      tier: SaasTier.Pro,
      status: SaasStatus.Active,
      payhereCustomerId: 'TOKEN-1',
      currentPeriodEnd: new Date('2026-08-15T00:00:00Z'),
      ...overrides,
    });

  it('charges a due gym the CURRENT tier price and renews with the credit extension', async () => {
    const { subRepo, attemptRepo, gateway, logRepo, useCase } = build([dueGym()]);

    const summary = await useCase.execute(NOW);

    expect(summary.due).toBe(1);
    expect(summary.charged).toBe(1);
    expect(attemptRepo.createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        gymId: 'gym-1',
        kind: 'renewal',
        targetTier: SaasTier.Pro,
        expectedAmount: 4990,
      })
    );
    expect(gateway.chargeCustomerToken).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 4990, customerToken: 'TOKEN-1', gymId: 'gym-1' })
    );
    const [saved, opts] = subRepo.save.mock.calls[0];
    expect((saved as Subscription).status).toBe(SaasStatus.Active);
    expect(opts).toEqual({ extendPeriod: true });
    expect(attemptRepo.markStatus).toHaveBeenCalledWith(
      expect.stringMatching(/^REN-gym-1-/),
      'succeeded',
      'PAY-TOKEN-1'
    );
    expect(logRepo.insertIfNew).toHaveBeenCalledWith(
      expect.objectContaining({ gymId: 'gym-1', messageType: 'TOKEN_CHARGE' })
    );
  });

  it('recovers a past_due gym back to active on a successful retry', async () => {
    const { subRepo, useCase } = build([dueGym({ status: SaasStatus.PastDue })]);

    const summary = await useCase.execute(NOW);

    expect(summary.charged).toBe(1);
    const saved = subRepo.save.mock.calls[0][0] as Subscription;
    expect(saved.status).toBe(SaasStatus.Active);
  });

  it('declined charge: attempt failed, active -> past_due, retry scheduled', async () => {
    const { subRepo, attemptRepo, gateway, useCase } = build([dueGym()]);
    gateway.chargeCustomerToken.mockResolvedValue({
      paymentId: 'PAY-F',
      statusCode: -2,
      statusMessage: 'Insufficient funds',
      signatureValid: true,
      rawPayload: {},
    });
    subRepo.scheduleChargeRetry.mockResolvedValue(new Date('2026-08-17T00:35:00Z'));

    const summary = await useCase.execute(NOW);

    expect(summary.charged).toBe(0);
    expect(summary.markedPastDue).toBe(1);
    expect(summary.retriesScheduled).toBe(1);
    expect(attemptRepo.markStatus).toHaveBeenCalledWith(expect.any(String), 'failed', 'PAY-F');
    const saved = subRepo.save.mock.calls[0][0] as Subscription;
    expect(saved.status).toBe(SaasStatus.PastDue);
    expect(saved.tier).toBe(SaasTier.Pro); // never a tier write
    expect(subRepo.scheduleChargeRetry).toHaveBeenCalledWith('gym-1');
  });

  it('declined retry on an already-past_due gym: no double past_due write, retry rescheduled', async () => {
    const { subRepo, gateway, useCase } = build([dueGym({ status: SaasStatus.PastDue })]);
    gateway.chargeCustomerToken.mockResolvedValue({
      paymentId: 'PAY-F2',
      statusCode: -2,
      statusMessage: null,
      signatureValid: true,
      rawPayload: {},
    });
    subRepo.scheduleChargeRetry.mockResolvedValue(null); // beyond grace: dunning takes over

    const summary = await useCase.execute(NOW);

    expect(summary.markedPastDue).toBe(0);
    expect(summary.retriesScheduled).toBe(0);
    expect(subRepo.save).not.toHaveBeenCalled();
  });

  it('skips a gym with an unresolved pending attempt (never double-charge, C-32)', async () => {
    const { attemptRepo, gateway, useCase } = build([dueGym()]);
    attemptRepo.createPending.mockRejectedValue(
      new ConflictError('A charge is already in progress for this gym')
    );

    const summary = await useCase.execute(NOW);

    expect(summary.skippedPendingAttempt).toBe(1);
    expect(gateway.chargeCustomerToken).not.toHaveBeenCalled();
  });

  it('transport fault: attempt left pending for the webhook, no state change, error surfaced', async () => {
    const { subRepo, attemptRepo, gateway, useCase } = build([dueGym()]);
    gateway.chargeCustomerToken.mockRejectedValue(
      new ExternalServiceError('PayHere', 'socket hang up')
    );

    const summary = await useCase.execute(NOW);

    expect(summary.awaitingConfirmation).toBe(1);
    expect(summary.errors).toHaveLength(1);
    expect(attemptRepo.markStatus).not.toHaveBeenCalled();
    expect(subRepo.save).not.toHaveBeenCalled();
  });

  it('gateway-pending outcome (status 0) leaves the attempt open for the webhook', async () => {
    const { subRepo, attemptRepo, gateway, useCase } = build([dueGym()]);
    gateway.chargeCustomerToken.mockResolvedValue({
      paymentId: 'PAY-P',
      statusCode: 0,
      statusMessage: null,
      signatureValid: true,
      rawPayload: {},
    });

    const summary = await useCase.execute(NOW);

    expect(summary.awaitingConfirmation).toBe(1);
    expect(attemptRepo.markStatus).not.toHaveBeenCalled();
    expect(subRepo.save).not.toHaveBeenCalled();
  });

  it('expires stale pending attempts before charging', async () => {
    const { attemptRepo, useCase } = build([]);
    attemptRepo.expireStale.mockResolvedValue(3);

    const summary = await useCase.execute(NOW);

    expect(summary.attemptsExpired).toBe(3);
    // TTL cutoff = now - CHARGE_ATTEMPT_TTL_HOURS
    const cutoff = attemptRepo.expireStale.mock.calls[0][0] as Date;
    expect(cutoff.getTime()).toBeLessThan(NOW.getTime());
  });

  it('one failing gym never blocks the rest of the batch', async () => {
    const bad = dueGym({ gymId: 'gym-bad' });
    const good = dueGym({ gymId: 'gym-good' });
    const { subRepo, attemptRepo, useCase } = build([bad, good]);
    attemptRepo.createPending
      .mockRejectedValueOnce(new Error('db hiccup'))
      .mockImplementation(async (a) => ({ ...a, status: 'pending', payherePaymentId: null, createdAt: new Date() }));

    const summary = await useCase.execute(NOW);

    expect(summary.errors).toHaveLength(1);
    expect(summary.charged).toBe(1);
    expect(subRepo.save).toHaveBeenCalledTimes(1);
  });
});
