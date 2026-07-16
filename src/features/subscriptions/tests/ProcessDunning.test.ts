import { ProcessDunning } from '@/features/subscriptions/services/ProcessDunning';
import { ProcessTrialExpiry } from '@/features/subscriptions/services/ProcessTrialExpiry';
import { mockSubscriptionRepo, mockIntentRepo } from '@/features/subscriptions/tests/subscription-mocks';

describe('ProcessDunning (UC-3)', () => {
  it('runs the SQL suspension pass and expires stale intents, returning counts', async () => {
    const subRepo = mockSubscriptionRepo();
    const intentRepo = mockIntentRepo();
    subRepo.runDunningSuspensions.mockResolvedValue({
      suspendedPastDue: 2,
      suspendedCanceled: 1,
    });
    intentRepo.expireStale.mockResolvedValue(3);

    const summary = await new ProcessDunning(subRepo, intentRepo).execute();

    expect(summary).toEqual({ suspendedPastDue: 2, suspendedCanceled: 1, intentsExpired: 3 });
    expect(subRepo.runDunningSuspensions).toHaveBeenCalledTimes(1);
    expect(intentRepo.expireStale).toHaveBeenCalledWith(expect.any(Date));
  });

  it('propagates repository failures (cron route logs them via CronLogger)', async () => {
    const subRepo = mockSubscriptionRepo();
    const intentRepo = mockIntentRepo();
    subRepo.runDunningSuspensions.mockRejectedValue(new Error('db down'));

    await expect(new ProcessDunning(subRepo, intentRepo).execute()).rejects.toThrow('db down');
    expect(intentRepo.expireStale).not.toHaveBeenCalled();
  });
});

describe('ProcessTrialExpiry (UC-5)', () => {
  it('runs the SQL trial-expiry pass and returns the suspended count', async () => {
    const subRepo = mockSubscriptionRepo();
    subRepo.runTrialExpiry.mockResolvedValue(4);

    const summary = await new ProcessTrialExpiry(subRepo).execute();

    expect(summary).toEqual({ suspendedTrials: 4 });
    expect(subRepo.runTrialExpiry).toHaveBeenCalledTimes(1);
  });

  it('propagates repository failures', async () => {
    const subRepo = mockSubscriptionRepo();
    subRepo.runTrialExpiry.mockRejectedValue(new Error('db down'));

    await expect(new ProcessTrialExpiry(subRepo).execute()).rejects.toThrow('db down');
  });
});
