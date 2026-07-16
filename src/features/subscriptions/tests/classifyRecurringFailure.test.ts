import { classifyRecurringFailure } from '@/features/subscriptions/domain/classifyRecurringFailure';
import { RecurringFailureClass } from '@/features/subscriptions/config/SubscriptionConfig';

describe('classifyRecurringFailure', () => {
  it('classifies -2 (installment failed) as retriable — PayHere retries', () => {
    expect(classifyRecurringFailure(-2, 'RECURRING_INSTALLMENT_FAILED')).toBe(
      RecurringFailureClass.Retriable
    );
    expect(classifyRecurringFailure(-2, null)).toBe(RecurringFailureClass.Retriable);
  });

  it('classifies -1 (canceled) as hard', () => {
    expect(classifyRecurringFailure(-1, null)).toBe(RecurringFailureClass.Hard);
  });

  it('classifies -3 (chargedback) as hard', () => {
    expect(classifyRecurringFailure(-3, null)).toBe(RecurringFailureClass.Hard);
  });

  it('classifies RECURRING_STOPPED as hard regardless of status code', () => {
    expect(classifyRecurringFailure(-2, 'RECURRING_STOPPED')).toBe(RecurringFailureClass.Hard);
    expect(classifyRecurringFailure(0, 'RECURRING_STOPPED')).toBe(RecurringFailureClass.Hard);
  });

  it('fails pessimistic (hard) for unknown codes', () => {
    expect(classifyRecurringFailure(-99, null)).toBe(RecurringFailureClass.Hard);
    expect(classifyRecurringFailure(0, 'SOMETHING_NEW')).toBe(RecurringFailureClass.Hard);
  });
});
