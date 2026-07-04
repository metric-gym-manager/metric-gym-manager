import { ProcessDunning } from '@/core/use-cases/subscription/ProcessDunning';
import { mockSubscriptionRepo, mockIntentRepo } from '@/core/test-utils/subscription-mocks';

describe('ProcessDunning (UC-3)', () => {
  it('runs the SQL downgrade pass and expires stale intents, returning counts', async () => {
    const subRepo = mockSubscriptionRepo();
    const intentRepo = mockIntentRepo();
    subRepo.runDunningDowngrades.mockResolvedValue({
      downgradedPastDue: 2,
      lapsedCanceled: 1,
    });
    intentRepo.expireStale.mockResolvedValue(3);

    const summary = await new ProcessDunning(subRepo, intentRepo).execute();

    expect(summary).toEqual({ downgradedPastDue: 2, lapsedCanceled: 1, intentsExpired: 3 });
    expect(subRepo.runDunningDowngrades).toHaveBeenCalledTimes(1);
    expect(intentRepo.expireStale).toHaveBeenCalledWith(expect.any(Date));
  });

  it('propagates repository failures (cron route logs them via CronLogger)', async () => {
    const subRepo = mockSubscriptionRepo();
    const intentRepo = mockIntentRepo();
    subRepo.runDunningDowngrades.mockRejectedValue(new Error('db down'));

    await expect(new ProcessDunning(subRepo, intentRepo).execute()).rejects.toThrow('db down');
    expect(intentRepo.expireStale).not.toHaveBeenCalled();
  });
});
