import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import UrgencyBadge from '../UrgencyBadge';

describe('UrgencyBadge', () => {
  describe('Critical urgency (>14 days overdue)', () => {
    it('should render with critical styling for 15 days overdue', () => {
      render(<UrgencyBadge daysOverdue={15} />);

      const badge = screen.getByRole('status');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-red-100', 'text-red-800');
      expect(screen.getByText(/15d overdue/i)).toBeInTheDocument();
    });

    it('should show "Critical" label for >14 days', () => {
      render(<UrgencyBadge daysOverdue={20} />);

      expect(screen.getByText('Critical')).toBeInTheDocument();
      expect(screen.getByText(/20d overdue/i)).toBeInTheDocument();
    });

    it('should handle very large overdue days', () => {
      render(<UrgencyBadge daysOverdue={100} />);

      expect(screen.getByText(/100d overdue/i)).toBeInTheDocument();
    });
  });

  describe('Warning urgency (7-14 days overdue)', () => {
    it('should render with warning styling for 7 days overdue', () => {
      render(<UrgencyBadge daysOverdue={7} />);

      const badge = screen.getByRole('status');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-orange-100', 'text-orange-800');
      expect(screen.getByText(/7d overdue/i)).toBeInTheDocument();
    });

    it('should render with warning styling for 14 days overdue', () => {
      render(<UrgencyBadge daysOverdue={14} />);

      const badge = screen.getByRole('status');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-orange-100', 'text-orange-800');
      expect(screen.getByText(/14d overdue/i)).toBeInTheDocument();
    });

    it('should show "Warning" label for 7-14 days', () => {
      render(<UrgencyBadge daysOverdue={10} />);

      expect(screen.getByText('Warning')).toBeInTheDocument();
      expect(screen.getByText(/10d overdue/i)).toBeInTheDocument();
    });
  });

  describe('Mild urgency (<7 days overdue)', () => {
    it('should render with mild styling for 1 day overdue', () => {
      render(<UrgencyBadge daysOverdue={1} />);

      const badge = screen.getByRole('status');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800');
      expect(screen.getByText(/1d overdue/i)).toBeInTheDocument();
    });

    it('should render with mild styling for 6 days overdue', () => {
      render(<UrgencyBadge daysOverdue={6} />);

      const badge = screen.getByText(/6d overdue/i);
      expect(badge).toBeInTheDocument();
    });

    it('should not show urgency label for <7 days', () => {
      render(<UrgencyBadge daysOverdue={5} />);

      expect(screen.queryByText('Critical')).not.toBeInTheDocument();
      expect(screen.queryByText('Warning')).not.toBeInTheDocument();
      expect(screen.getByText(/5d overdue/i)).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle 0 days overdue', () => {
      render(<UrgencyBadge daysOverdue={0} />);

      expect(screen.getByText(/0d overdue/i)).toBeInTheDocument();
    });

    it('should handle negative values gracefully', () => {
      render(<UrgencyBadge daysOverdue={-5} />);

      // Should still render something (component decides how to handle)
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA role', () => {
      render(<UrgencyBadge daysOverdue={10} />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should have descriptive aria-label for critical urgency', () => {
      const { container } = render(<UrgencyBadge daysOverdue={20} />);

      const badge = container.querySelector('[role="status"]');
      expect(badge).toHaveAttribute('aria-label', expect.stringContaining('20 days overdue'));
    });
  });
});
