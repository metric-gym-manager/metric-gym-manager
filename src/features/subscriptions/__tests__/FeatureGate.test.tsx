import { render, screen } from '@testing-library/react';
import FeatureGate from '../components/FeatureGate';

const mockUseSubscription = jest.fn();
jest.mock('../hooks/useSubscription', () => ({
  useSubscription: () => mockUseSubscription(),
}));

function withCapabilities(announcements: boolean) {
  return {
    isLoading: false,
    data: {
      proPriceLkr: 4900,
      subscription: {
        capabilities: { automatedReminders: announcements, announcements },
      },
    },
  };
}

describe('FeatureGate', () => {
  it('renders children when the plan includes the feature', () => {
    mockUseSubscription.mockReturnValue(withCapabilities(true));
    render(
      <FeatureGate feature="announcements" featureLabel="Announcements">
        <p>the real page</p>
      </FeatureGate>
    );
    expect(screen.getByText('the real page')).toBeInTheDocument();
    expect(screen.queryByTestId('feature-gate-upsell')).not.toBeInTheDocument();
  });

  it('renders the upgrade panel instead of children when the feature is restricted', () => {
    mockUseSubscription.mockReturnValue(withCapabilities(false));
    render(
      <FeatureGate feature="announcements" featureLabel="Announcements">
        <p>the real page</p>
      </FeatureGate>
    );
    const upsell = screen.getByTestId('feature-gate-upsell');
    expect(upsell).toHaveTextContent(/announcements is a growth feature/i);
    expect(upsell).toHaveTextContent(/upgrade to use this feature/i);
    expect(screen.getByRole('link', { name: /upgrade to growth/i })).toHaveAttribute(
      'href',
      '/settings/billing'
    );
    expect(screen.queryByText('the real page')).not.toBeInTheDocument();
  });

  it('renders neither children nor upsell while loading (no feature flash)', () => {
    mockUseSubscription.mockReturnValue({ isLoading: true, data: undefined });
    render(
      <FeatureGate feature="announcements" featureLabel="Announcements">
        <p>the real page</p>
      </FeatureGate>
    );
    expect(screen.queryByText('the real page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('feature-gate-upsell')).not.toBeInTheDocument();
  });
});
