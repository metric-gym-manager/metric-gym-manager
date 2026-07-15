import { render, screen } from '@testing-library/react';
import PricingTable from '@/features/subscriptions/components/PricingTable';
import {
  SaasTier,
  SaasStatus,
  LITE_TIER_MEMBER_LIMIT,
} from '@/core/utils/constants/SubscriptionConfig';
import type { SerializedSubscription } from '@/features/subscriptions/types';

function makeSerialized(
  overrides: Partial<SerializedSubscription> = {}
): SerializedSubscription {
  return {
    subscriptionTier: SaasTier.Lite,
    subscription_tier: SaasTier.Lite,
    subscriptionStatus: SaasStatus.Active,
    subscription_status: SaasStatus.Active,
    memberCount: 10,
    member_count: 10,
    memberLimit: LITE_TIER_MEMBER_LIMIT,
    member_limit: LITE_TIER_MEMBER_LIMIT,
    currentPeriodEnd: null,
    current_period_end: null,
    trialEndsAt: null,
    trial_ends_at: null,
    graceEndsAt: null,
    grace_ends_at: null,
    pastDueReason: null,
    past_due_reason: null,
    canAddMember: true,
    capabilities: { automatedReminders: true, announcements: true, accessControlHardware: false },
    remainingMemberSlots: LITE_TIER_MEMBER_LIMIT - 10,
    remaining_member_slots: LITE_TIER_MEMBER_LIMIT - 10,
    isComplimentary: false,
    is_complimentary: false,
    hasSavedCard: false,
    has_saved_card: false,
    ...overrides,
  };
}

/**
 * Enterprise is sales-led (custom access-control hardware is a scoped, installed
 * engagement) — the column must never offer a self-serve charge CTA. It routes
 * to /contact instead. Lite/Pro keep their normal checkout CTAs.
 */
describe('PricingTable — sales-led Enterprise', () => {
  it('trialing Lite gym: Enterprise shows a "Contact sales" link to /contact, never a charge CTA', () => {
    const onUpgrade = jest.fn();
    render(
      <PricingTable
        subscription={makeSerialized({
          subscriptionStatus: SaasStatus.Trialing,
          subscription_status: SaasStatus.Trialing,
        })}
        litePriceLkr={2990}
        proPriceLkr={4990}
        enterprisePriceLkr={6990}
        onUpgrade={onUpgrade}
      />
    );

    // Enterprise is a sales conversation, not a checkout.
    const contact = screen.getByRole('link', { name: /contact sales/i });
    expect(contact).toHaveAttribute('href', '/contact');

    // No self-serve Enterprise purchase button exists in any state.
    expect(
      screen.queryByRole('button', { name: /(upgrade|switch|subscribe) to enterprise/i })
    ).not.toBeInTheDocument();

    // Lite/Pro still checkout normally.
    expect(screen.getByRole('button', { name: /subscribe to lite/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upgrade to pro/i })).toBeInTheDocument();
  });

  it('active Lite gym with a saved card: Pro is a one-click switch, Enterprise is still Contact sales', () => {
    render(
      <PricingTable
        subscription={makeSerialized({ hasSavedCard: true, has_saved_card: true })}
        litePriceLkr={2990}
        proPriceLkr={4990}
        enterprisePriceLkr={6990}
        onUpgrade={jest.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /switch to pro/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /contact sales/i })).toHaveAttribute('href', '/contact');
    expect(
      screen.queryByRole('button', { name: /(upgrade|switch|subscribe) to enterprise/i })
    ).not.toBeInTheDocument();
  });

  it('complimentary Enterprise gym: Enterprise column reads "Current plan", not a contact link', () => {
    render(
      <PricingTable
        subscription={makeSerialized({
          subscriptionTier: SaasTier.Enterprise,
          subscription_tier: SaasTier.Enterprise,
          memberLimit: null,
          member_limit: null,
          isComplimentary: true,
          is_complimentary: true,
        })}
        litePriceLkr={2990}
        proPriceLkr={4990}
        enterprisePriceLkr={6990}
        onUpgrade={jest.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /current plan/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /contact sales/i })).not.toBeInTheDocument();
  });
});
