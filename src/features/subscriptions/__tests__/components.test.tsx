import { render, screen } from '@testing-library/react';
import CurrentPlanCard from '@/features/subscriptions/components/CurrentPlanCard';
import PastDueBanner from '@/features/subscriptions/components/PastDueBanner';
import QuotaReachedUpsell from '@/features/subscriptions/components/QuotaReachedUpsell';
import {
  SaasTier,
  SaasStatus,
  FREE_TIER_MEMBER_LIMIT,
  RecurringFailureClass,
} from '@/core/utils/constants/SubscriptionConfig';
import type { SerializedSubscription } from '@/features/subscriptions/types';

function makeSerialized(
  overrides: Partial<SerializedSubscription> = {}
): SerializedSubscription {
  return {
    subscriptionTier: SaasTier.Free,
    subscription_tier: SaasTier.Free,
    subscriptionStatus: SaasStatus.Active,
    subscription_status: SaasStatus.Active,
    memberCount: 10,
    member_count: 10,
    memberLimit: FREE_TIER_MEMBER_LIMIT,
    member_limit: FREE_TIER_MEMBER_LIMIT,
    currentPeriodEnd: null,
    current_period_end: null,
    graceEndsAt: null,
    grace_ends_at: null,
    pastDueReason: null,
    past_due_reason: null,
    canAddMember: true,
    ...overrides,
  };
}

const noop = () => undefined;

describe('CurrentPlanCard (state-to-UI mapping, plan §5.3)', () => {
  it('free below limit: usage meter + Upgrade CTA, no cancel', () => {
    render(
      <CurrentPlanCard
        subscription={makeSerialized()}
        onUpgradeClick={noop}
        onCancelClick={noop}
      />
    );
    expect(screen.getByText('Free Plan')).toBeInTheDocument();
    expect(screen.getByText(`10 / ${FREE_TIER_MEMBER_LIMIT}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upgrade to pro/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel subscription/i })).not.toBeInTheDocument();
  });

  it('free over limit (post-downgrade): explains kept members, Re-subscribe CTA', () => {
    render(
      <CurrentPlanCard
        subscription={makeSerialized({
          subscriptionStatus: SaasStatus.Canceled,
          subscription_status: SaasStatus.Canceled,
          memberCount: 500,
          member_count: 500,
        })}
        onUpgradeClick={noop}
        onCancelClick={noop}
      />
    );
    expect(screen.getByText(/existing members are kept/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /re-subscribe to pro/i })).toBeInTheDocument();
  });

  it('pro/active: unlimited members, renewal date, cancel visible', () => {
    render(
      <CurrentPlanCard
        subscription={makeSerialized({
          subscriptionTier: SaasTier.Pro,
          subscription_tier: SaasTier.Pro,
          memberLimit: null,
          member_limit: null,
          currentPeriodEnd: '2026-08-04',
          current_period_end: '2026-08-04',
        })}
        onUpgradeClick={noop}
        onCancelClick={noop}
      />
    );
    expect(screen.getByText('Pro Plan')).toBeInTheDocument();
    expect(screen.getByText(/unlimited/)).toBeInTheDocument();
    expect(screen.getByText(/renews on/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel subscription/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upgrade/i })).not.toBeInTheDocument();
  });

  it('pro/canceled paid-through: "Pro until {date}", re-subscribe, no cancel', () => {
    render(
      <CurrentPlanCard
        subscription={makeSerialized({
          subscriptionTier: SaasTier.Pro,
          subscription_tier: SaasTier.Pro,
          subscriptionStatus: SaasStatus.Canceled,
          subscription_status: SaasStatus.Canceled,
          memberLimit: null,
          member_limit: null,
          currentPeriodEnd: '2026-08-04',
          current_period_end: '2026-08-04',
        })}
        onUpgradeClick={noop}
        onCancelClick={noop}
      />
    );
    expect(screen.getByText(/pro features continue until/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /re-subscribe to pro/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel subscription/i })).not.toBeInTheDocument();
  });
});

describe('PastDueBanner (C-22 copy branching)', () => {
  const pastDue = (reason: RecurringFailureClass) =>
    makeSerialized({
      subscriptionTier: SaasTier.Pro,
      subscription_tier: SaasTier.Pro,
      subscriptionStatus: SaasStatus.PastDue,
      subscription_status: SaasStatus.PastDue,
      graceEndsAt: '2099-01-08',
      grace_ends_at: '2099-01-08',
      pastDueReason: reason,
      past_due_reason: reason,
    });

  it('retriable: "PayHere will retry" copy', () => {
    render(<PastDueBanner subscription={pastDue(RecurringFailureClass.Retriable)} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/payhere will retry/i);
    expect(screen.getByRole('alert')).toHaveTextContent('2099-01-08');
  });

  it('hard: "won’t be retried … re-subscribe" copy', () => {
    render(<PastDueBanner subscription={pastDue(RecurringFailureClass.Hard)} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/won’t be retried/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/re-subscribe/i);
  });
});

describe('QuotaReachedUpsell', () => {
  it('renders the limit copy and links to the billing page', () => {
    render(<QuotaReachedUpsell memberCount={FREE_TIER_MEMBER_LIMIT} />);
    expect(screen.getByTestId('quota-reached-upsell')).toHaveTextContent(
      `${FREE_TIER_MEMBER_LIMIT}/${FREE_TIER_MEMBER_LIMIT}`
    );
    expect(screen.getByRole('link', { name: /upgrade to pro/i })).toHaveAttribute(
      'href',
      '/settings/billing'
    );
  });
});
