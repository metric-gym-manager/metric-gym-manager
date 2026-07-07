import {
  HandlePayHereWebhook,
  WebhookOutcome,
} from '@/core/use-cases/subscription/HandlePayHereWebhook';
import { SaasTier, SaasStatus } from '@/core/utils/constants/SubscriptionConfig';
import { Subscription } from '@/core/domain/subscription/Subscription';
import {
  makeSubscription,
  makeIntent,
  mockSubscriptionRepo,
  mockIntentRepo,
  mockLogRepo,
} from '@/core/test-utils/subscription-mocks';

/** Base signed-and-verified notification fields (route verified md5sig already). */
function fields(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    merchant_id: '1211149',
    order_id: 'SUB-gym-1-1',
    payment_id: 'PAY-1',
    payhere_amount: '4900.00',
    payhere_currency: 'LKR',
    status_code: '2',
    md5sig: 'SHOULD-NEVER-PERSIST',
    ...overrides,
  };
}

describe('HandlePayHereWebhook (UC-2)', () => {
  function build() {
    const subRepo = mockSubscriptionRepo();
    const intentRepo = mockIntentRepo();
    const logRepo = mockLogRepo();
    const useCase = new HandlePayHereWebhook(subRepo, intentRepo, logRepo);
    return { subRepo, intentRepo, logRepo, useCase };
  }

  describe('initial activation (intent-driven)', () => {
    it('PROVISIONED: activates a Free gym, completes the intent, extends the period', async () => {
      const { subRepo, intentRepo, logRepo, useCase } = build();
      intentRepo.findPendingByOrderId.mockResolvedValue(makeIntent());
      subRepo.findByGymId.mockResolvedValue(makeSubscription());

      const { outcome } = await useCase.execute(fields({ subscription_id: 'PHSUB-A' }));

      expect(outcome).toBe(WebhookOutcome.Provisioned);
      const [savedSub, opts] = subRepo.save.mock.calls[0];
      expect((savedSub as Subscription).tier).toBe(SaasTier.Growth);
      expect((savedSub as Subscription).status).toBe(SaasStatus.Active);
      expect((savedSub as Subscription).payhereSubscriptionId).toBe('PHSUB-A');
      expect(opts).toEqual({ extendPeriod: true });
      expect(intentRepo.markStatus).toHaveBeenCalledWith('SUB-gym-1-1', 'completed');
      expect(logRepo.insertIfNew).toHaveBeenCalledTimes(1);
    });

    it('redacts md5sig from the persisted raw payload (C-24)', async () => {
      const { subRepo, intentRepo, logRepo, useCase } = build();
      intentRepo.findPendingByOrderId.mockResolvedValue(makeIntent());
      subRepo.findByGymId.mockResolvedValue(makeSubscription());

      await useCase.execute(fields());

      const input = logRepo.insertIfNew.mock.calls[0][0];
      expect(input.rawPayload.md5sig).toBe('[REDACTED]');
      expect(JSON.stringify(input)).not.toContain('SHOULD-NEVER-PERSIST');
    });

    it('AMOUNT_MISMATCH: tampered/wrong amount fails the intent and provisions nothing', async () => {
      const { subRepo, intentRepo, useCase } = build();
      intentRepo.findPendingByOrderId.mockResolvedValue(makeIntent({ expectedAmount: 4900 }));
      subRepo.findByGymId.mockResolvedValue(makeSubscription());

      const { outcome } = await useCase.execute(fields({ payhere_amount: '1.00' }));

      expect(outcome).toBe(WebhookOutcome.AmountMismatch);
      expect(subRepo.save).not.toHaveBeenCalled();
      expect(intentRepo.markStatus).toHaveBeenCalledWith('SUB-gym-1-1', 'failed');
    });

    it('re-subscribe from pro/canceled activates with the NEW subscription id', async () => {
      const { subRepo, intentRepo, useCase } = build();
      intentRepo.findPendingByOrderId.mockResolvedValue(makeIntent());
      subRepo.findByGymId.mockResolvedValue(
        makeSubscription({
          tier: SaasTier.Growth,
          status: SaasStatus.Canceled,
          payhereSubscriptionId: 'PHSUB-A',
        })
      );

      const { outcome } = await useCase.execute(fields({ subscription_id: 'PHSUB-B' }));

      expect(outcome).toBe(WebhookOutcome.Provisioned);
      const saved = subRepo.save.mock.calls[0][0] as Subscription;
      expect(saved.payhereSubscriptionId).toBe('PHSUB-B');
      expect(saved.status).toBe(SaasStatus.Active);
    });

    it('initial checkout failure (-2) fails the intent and leaves the gym Free', async () => {
      const { subRepo, intentRepo, useCase } = build();
      intentRepo.findPendingByOrderId.mockResolvedValue(makeIntent());
      subRepo.findByGymId.mockResolvedValue(makeSubscription());

      const { outcome } = await useCase.execute(fields({ status_code: '-2' }));

      expect(outcome).toBe(WebhookOutcome.LoggedOnly);
      expect(intentRepo.markStatus).toHaveBeenCalledWith('SUB-gym-1-1', 'failed');
      expect(subRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('idempotency', () => {
    it('ALREADY_PROCESSED: duplicate payment_id changes no state', async () => {
      const { subRepo, intentRepo, logRepo, useCase } = build();
      intentRepo.findPendingByOrderId.mockResolvedValue(makeIntent());
      subRepo.findByGymId.mockResolvedValue(makeSubscription());
      logRepo.insertIfNew.mockResolvedValue(false);

      const { outcome } = await useCase.execute(fields());

      expect(outcome).toBe(WebhookOutcome.AlreadyProcessed);
      expect(subRepo.save).not.toHaveBeenCalled();
      expect(intentRepo.markStatus).not.toHaveBeenCalled();
    });
  });

  describe('recurring lifecycle (subscription-id-driven)', () => {
    const proActive = () =>
      makeSubscription({
        tier: SaasTier.Growth,
        status: SaasStatus.Active,
        payhereSubscriptionId: 'PHSUB-A',
      });
    const proPastDue = () =>
      makeSubscription({
        tier: SaasTier.Growth,
        status: SaasStatus.PastDue,
        payhereSubscriptionId: 'PHSUB-A',
      });

    it('RENEWED: installment success extends the period (extendPeriod: true = charge-date anchor, C-23)', async () => {
      const { subRepo, useCase } = build();
      subRepo.findByPayhereSubscriptionId.mockResolvedValue(proActive());

      const { outcome } = await useCase.execute(
        fields({ order_id: 'SUB-gym-1-0', subscription_id: 'PHSUB-A', payment_id: 'PAY-9' })
      );

      expect(outcome).toBe(WebhookOutcome.Renewed);
      expect(subRepo.save).toHaveBeenCalledWith(expect.anything(), { extendPeriod: true });
    });

    it('RENEWED: recovery from past_due back to active', async () => {
      const { subRepo, useCase } = build();
      subRepo.findByPayhereSubscriptionId.mockResolvedValue(proPastDue());

      const { outcome } = await useCase.execute(
        fields({ subscription_id: 'PHSUB-A', payment_id: 'PAY-10' })
      );

      expect(outcome).toBe(WebhookOutcome.Renewed);
      const saved = subRepo.save.mock.calls[0][0] as Subscription;
      expect(saved.status).toBe(SaasStatus.Active);
    });

    it('MARKED_PAST_DUE: installment failure (-2) on active starts grace, never downgrades', async () => {
      const { subRepo, logRepo, useCase } = build();
      subRepo.findByPayhereSubscriptionId.mockResolvedValue(proActive());

      const { outcome } = await useCase.execute(
        fields({
          subscription_id: 'PHSUB-A',
          payment_id: 'PAY-11',
          status_code: '-2',
          message_type: 'RECURRING_INSTALLMENT_FAILED',
          status_message: 'Insufficient funds',
        })
      );

      expect(outcome).toBe(WebhookOutcome.MarkedPastDue);
      const saved = subRepo.save.mock.calls[0][0] as Subscription;
      expect(saved.status).toBe(SaasStatus.PastDue);
      expect(saved.tier).toBe(SaasTier.Growth); // no downgrade here — dunning cron only
      // classification capture (C-22): message_type/status_message persisted
      const logInput = logRepo.insertIfNew.mock.calls[0][0];
      expect(logInput.messageType).toBe('RECURRING_INSTALLMENT_FAILED');
      expect(logInput.statusMessage).toBe('Insufficient funds');
    });

    it('LOGGED_ONLY: failure on already-past_due changes nothing', async () => {
      const { subRepo, useCase } = build();
      subRepo.findByPayhereSubscriptionId.mockResolvedValue(proPastDue());

      const { outcome } = await useCase.execute(
        fields({ subscription_id: 'PHSUB-A', payment_id: 'PAY-12', status_code: '-2' })
      );

      expect(outcome).toBe(WebhookOutcome.LoggedOnly);
      expect(subRepo.save).not.toHaveBeenCalled();
    });

    it('LOGGED_PENDING: status 0 logs only', async () => {
      const { subRepo, useCase } = build();
      subRepo.findByPayhereSubscriptionId.mockResolvedValue(proActive());

      const { outcome } = await useCase.execute(
        fields({ subscription_id: 'PHSUB-A', payment_id: 'PAY-13', status_code: '0' })
      );

      expect(outcome).toBe(WebhookOutcome.LoggedPending);
      expect(subRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('cancel reconciliation + identity guard (C-21)', () => {
    it('RECONCILED_CANCELED: RECURRING_STOPPED on pro/active applies cancelPro', async () => {
      const { subRepo, useCase } = build();
      subRepo.findByPayhereSubscriptionId.mockResolvedValue(
        makeSubscription({
          tier: SaasTier.Growth,
          status: SaasStatus.Active,
          payhereSubscriptionId: 'PHSUB-A',
        })
      );

      const { outcome } = await useCase.execute(
        fields({
          subscription_id: 'PHSUB-A',
          payment_id: 'PAY-14',
          status_code: '-1',
          message_type: 'RECURRING_STOPPED',
          item_rec_status: '-1',
        })
      );

      expect(outcome).toBe(WebhookOutcome.ReconciledCanceled);
      const saved = subRepo.save.mock.calls[0][0] as Subscription;
      expect(saved.status).toBe(SaasStatus.Canceled);
      expect(saved.tier).toBe(SaasTier.Growth); // paid-through, tier retained
    });

    it('STALE_EVENT: RECURRING_STOPPED replay on already-canceled sub is a no-op', async () => {
      const { subRepo, useCase } = build();
      subRepo.findByPayhereSubscriptionId.mockResolvedValue(
        makeSubscription({
          tier: SaasTier.Growth,
          status: SaasStatus.Canceled,
          payhereSubscriptionId: 'PHSUB-A',
        })
      );

      const { outcome } = await useCase.execute(
        fields({
          subscription_id: 'PHSUB-A',
          payment_id: 'PAY-15',
          status_code: '-1',
          message_type: 'RECURRING_STOPPED',
        })
      );

      expect(outcome).toBe(WebhookOutcome.StaleEvent);
      expect(subRepo.save).not.toHaveBeenCalled();
    });

    it('STALE_EVENT: late RECURRING_STOPPED for replaced sub A must not cancel new sub B', async () => {
      const { subRepo, useCase } = build();
      // Stored id is B; lookup by A misses; custom_1 fallback resolves the gym
      subRepo.findByPayhereSubscriptionId.mockResolvedValue(null);
      subRepo.findByGymId.mockResolvedValue(
        makeSubscription({
          tier: SaasTier.Growth,
          status: SaasStatus.Active,
          payhereSubscriptionId: 'PHSUB-B',
        })
      );

      const { outcome } = await useCase.execute(
        fields({
          subscription_id: 'PHSUB-A', // the replaced subscription
          custom_1: 'gym-1',
          payment_id: 'PAY-16',
          status_code: '-1',
          message_type: 'RECURRING_STOPPED',
        })
      );

      expect(outcome).toBe(WebhookOutcome.StaleEvent);
      expect(subRepo.save).not.toHaveBeenCalled(); // B untouched
    });

    it('STALE_EVENT: late installment success for replaced sub A must not extend B', async () => {
      const { subRepo, useCase } = build();
      subRepo.findByPayhereSubscriptionId.mockResolvedValue(null);
      subRepo.findByGymId.mockResolvedValue(
        makeSubscription({
          tier: SaasTier.Growth,
          status: SaasStatus.Active,
          payhereSubscriptionId: 'PHSUB-B',
        })
      );

      const { outcome } = await useCase.execute(
        fields({ subscription_id: 'PHSUB-A', custom_1: 'gym-1', payment_id: 'PAY-17' })
      );

      expect(outcome).toBe(WebhookOutcome.StaleEvent);
      expect(subRepo.save).not.toHaveBeenCalled();
    });

    it('STALE_EVENT: installment success on voluntarily-canceled sub never un-cancels', async () => {
      const { subRepo, useCase } = build();
      subRepo.findByPayhereSubscriptionId.mockResolvedValue(
        makeSubscription({
          tier: SaasTier.Growth,
          status: SaasStatus.Canceled,
          payhereSubscriptionId: 'PHSUB-A',
        })
      );

      const { outcome } = await useCase.execute(
        fields({ subscription_id: 'PHSUB-A', payment_id: 'PAY-18' })
      );

      expect(outcome).toBe(WebhookOutcome.StaleEvent);
      expect(subRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('unresolved + malformed', () => {
    it('UNRESOLVED: no intent, no subscription match, no custom_1 -> null-gym audit row', async () => {
      const { subRepo, logRepo, useCase } = build();
      subRepo.findByPayhereSubscriptionId.mockResolvedValue(null);

      const { outcome } = await useCase.execute(
        fields({ order_id: 'UNKNOWN-1', subscription_id: 'PHSUB-X' })
      );

      expect(outcome).toBe(WebhookOutcome.Unresolved);
      expect(logRepo.insertIfNew).toHaveBeenCalledWith(
        expect.objectContaining({ gymId: null, payherePaymentId: 'PAY-1' })
      );
      expect(subRepo.save).not.toHaveBeenCalled();
    });

    it('LOGGED_ONLY: resolvable gym but missing payment_id -> capped audit, no state change', async () => {
      const { subRepo, logRepo, useCase } = build();
      subRepo.findByGymId.mockResolvedValue(makeSubscription());

      const f = fields({ custom_1: 'gym-1' });
      delete f.payment_id;
      const { outcome } = await useCase.execute(f);

      expect(outcome).toBe(WebhookOutcome.LoggedOnly);
      expect(logRepo.insertInvalid).toHaveBeenCalled();
      expect(subRepo.save).not.toHaveBeenCalled();
    });

    it('LOGGED_ONLY: unknown status code', async () => {
      const { subRepo, useCase } = build();
      subRepo.findByGymId.mockResolvedValue(
        makeSubscription({ tier: SaasTier.Growth, status: SaasStatus.Active, payhereSubscriptionId: 'PHSUB-A' })
      );

      const { outcome } = await useCase.execute(
        fields({ custom_1: 'gym-1', subscription_id: 'PHSUB-A', status_code: '7' })
      );

      expect(outcome).toBe(WebhookOutcome.LoggedOnly);
      expect(subRepo.save).not.toHaveBeenCalled();
    });
  });
});
