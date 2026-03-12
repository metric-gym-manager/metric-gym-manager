import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConfirmDialog from '../ConfirmDialog';

describe('ConfirmDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    title: 'Confirm Action',
    description: 'Are you sure you want to proceed?',
    onConfirm: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render when open is true', () => {
    render(<ConfirmDialog {...defaultProps} />);

    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
  });

  it('should not render when open is false', () => {
    render(<ConfirmDialog {...defaultProps} open={false} />);

    expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument();
  });

  it('should display custom confirm and cancel button text', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmText="Yes, Delete"
        cancelText="No, Keep"
      />
    );

    expect(screen.getByText('Yes, Delete')).toBeInTheDocument();
    expect(screen.getByText('No, Keep')).toBeInTheDocument();
  });

  it('should display default button text when not provided', () => {
    render(<ConfirmDialog {...defaultProps} />);

    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should call onConfirm when confirm button is clicked', () => {
    render(<ConfirmDialog {...defaultProps} />);

    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should call onOpenChange with false when cancel button is clicked', () => {
    render(<ConfirmDialog {...defaultProps} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should apply destructive variant styling when specified', () => {
    render(<ConfirmDialog {...defaultProps} variant="destructive" />);

    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toHaveClass('bg-red-600');
  });

  it('should not apply destructive styling for default variant', () => {
    render(<ConfirmDialog {...defaultProps} variant="default" />);

    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).not.toHaveClass('bg-red-600');
  });

  it('should handle long descriptions', () => {
    const longDescription = 'This is a very long description that should still be displayed correctly. '.repeat(10);
    render(<ConfirmDialog {...defaultProps} description={longDescription} />);

    // Use regex matcher for long text to handle potential text splitting
    expect(screen.getByText(/This is a very long description/i)).toBeInTheDocument();
  });

  it('should be accessible with proper ARIA attributes', () => {
    render(<ConfirmDialog {...defaultProps} />);

    // AlertDialog should have proper role
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
  });
});
