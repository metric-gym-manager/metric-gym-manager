import { render, screen } from '@testing-library/react';
import StarterLimitBar from '../components/StarterLimitBar';
import { SaasTier, STARTER_TIER_MEMBER_LIMIT } from '@/core/utils/constants/SubscriptionConfig';

const mockUsePathname = jest.fn<string, []>();
jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

const mockUseSubscription = jest.fn();
jest.mock('../hooks/useSubscription', () => ({
  useSubscription: () => mockUseSubscription(),
}));

function subscriptionData(tier: SaasTier, memberCount: number, remaining: number | null) {
  return {
    data: {
      proPriceLkr: 4900,
      subscription: {
        subscriptionTier: tier,
        memberCount,
        memberLimit: tier === SaasTier.Starter ? STARTER_TIER_MEMBER_LIMIT : null,
        remainingMemberSlots: remaining,
      },
    },
  };
}

describe('StarterLimitBar', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/dashboard');
  });

  it('shows remaining slots and an Upgrade CTA for a Starter gym', () => {
    mockUseSubscription.mockReturnValue(subscriptionData(SaasTier.Starter, 33, 7));
    render(<StarterLimitBar />);
    const bar = screen.getByTestId('starter-limit-bar');
    expect(bar).toHaveTextContent(`7 of ${STARTER_TIER_MEMBER_LIMIT} member slots left`);
    expect(screen.getByRole('link', { name: /upgrade/i })).toHaveAttribute(
      'href',
      '/settings/billing'
    );
  });

  it('renders the at-limit state when no slots remain', () => {
    mockUseSubscription.mockReturnValue(subscriptionData(SaasTier.Starter, 40, 0));
    render(<StarterLimitBar />);
    expect(screen.getByTestId('starter-limit-bar')).toHaveTextContent(/member limit reached/i);
  });

  it('renders nothing for a Growth gym', () => {
    mockUseSubscription.mockReturnValue(subscriptionData(SaasTier.Growth, 999, null));
    render(<StarterLimitBar />);
    expect(screen.queryByTestId('starter-limit-bar')).not.toBeInTheDocument();
  });

  it('renders nothing anywhere under /settings (billing lives there)', () => {
    mockUsePathname.mockReturnValue('/settings/billing');
    mockUseSubscription.mockReturnValue(subscriptionData(SaasTier.Starter, 33, 7));
    render(<StarterLimitBar />);
    expect(screen.queryByTestId('starter-limit-bar')).not.toBeInTheDocument();
  });

  it('renders nothing while the subscription is loading', () => {
    mockUseSubscription.mockReturnValue({ data: undefined });
    render(<StarterLimitBar />);
    expect(screen.queryByTestId('starter-limit-bar')).not.toBeInTheDocument();
  });
});
