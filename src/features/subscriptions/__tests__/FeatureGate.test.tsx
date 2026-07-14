import { render, screen } from '@testing-library/react';
import FeatureGate from '../components/FeatureGate';

const mockUseSubscription = jest.fn();
jest.mock('../hooks/useSubscription', () => ({
  useSubscription: () => mockUseSubscription(),
}));

function withCapabilities(caps: {
  automatedReminders?: boolean;
  announcements?: boolean;
  accessControlHardware?: boolean;
}) {
  return {
    isLoading: false,
    data: {
      litePriceLkr: 2990,
      subscription: {
        capabilities: {
          automatedReminders: true,
          announcements: true,
          accessControlHardware: false,
          ...caps,
        },
      },
    },
  };
}

describe('FeatureGate', () => {
  it('renders children when the plan includes the feature', () => {
    mockUseSubscription.mockReturnValue(withCapabilities({ announcements: true }));
    render(
      <FeatureGate feature="announcements" featureLabel="Announcements">
        <p>the real page</p>
      </FeatureGate>
    );
    expect(screen.getByText('the real page')).toBeInTheDocument();
    expect(screen.queryByTestId('feature-gate-upsell')).not.toBeInTheDocument();
  });

  it('gates accessControlHardware (the Enterprise differentiator) with an Enterprise upsell', () => {
    mockUseSubscription.mockReturnValue(withCapabilities({ accessControlHardware: false }));
    render(
      <FeatureGate feature="accessControlHardware" featureLabel="Access control">
        <p>the real page</p>
      </FeatureGate>
    );
    const upsell = screen.getByTestId('feature-gate-upsell');
    expect(upsell).toHaveTextContent(/access control is a enterprise feature/i);
    expect(upsell).toHaveTextContent(/upgrade to use this feature/i);
    expect(screen.getByRole('link', { name: /upgrade to enterprise/i })).toHaveAttribute(
      'href',
      '/settings/billing'
    );
    expect(screen.queryByText('the real page')).not.toBeInTheDocument();
  });

  it('passes accessControlHardware through for an Enterprise plan', () => {
    mockUseSubscription.mockReturnValue(withCapabilities({ accessControlHardware: true }));
    render(
      <FeatureGate feature="accessControlHardware" featureLabel="Access control">
        <p>the real page</p>
      </FeatureGate>
    );
    expect(screen.getByText('the real page')).toBeInTheDocument();
  });

  it('still upsells (to Pro) if a universal capability were ever re-gated', () => {
    mockUseSubscription.mockReturnValue(withCapabilities({ announcements: false }));
    render(
      <FeatureGate feature="announcements" featureLabel="Announcements">
        <p>the real page</p>
      </FeatureGate>
    );
    expect(screen.getByTestId('feature-gate-upsell')).toHaveTextContent(
      /announcements is a pro feature/i
    );
    expect(screen.getByRole('link', { name: /upgrade to pro/i })).toBeInTheDocument();
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
