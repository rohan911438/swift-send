import { render, screen } from '@testing-library/react';
import { FeeBreakdown } from '../FeeBreakdown';

describe('FeeBreakdown Component', () => {
  it('should render all fee components correctly', () => {
    render(<FeeBreakdown amount={100} />);

    // Check main sections
    expect(screen.getByText('Fee Transparency')).toBeInTheDocument();
    expect(screen.getByText('Your amount')).toBeInTheDocument();
    expect(screen.getByText('Stellar network fee')).toBeInTheDocument();
    expect(screen.getByText('Service fee (0.5%)')).toBeInTheDocument();
    expect(screen.getByText('Total fees')).toBeInTheDocument();
    expect(screen.getByText('Recipient receives')).toBeInTheDocument();
  });

  it('should display correct amounts', () => {
    render(<FeeBreakdown amount={100} />);

    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByText('$0.0000')).toBeInTheDocument(); // Network fee rounded
    expect(screen.getByText('$0.50')).toBeInTheDocument();
    expect(screen.getByText('$99.50 USDC')).toBeInTheDocument(); // Recipient amount rounded
  });

  it('should handle small amounts correctly', () => {
    render(<FeeBreakdown amount={1} />);

    expect(screen.getByText('$1.00')).toBeInTheDocument();
    expect(screen.getByText('$0.01')).toBeInTheDocument();
    expect(screen.getByText('$0.99 USDC')).toBeInTheDocument();
  });

  it('should handle large amounts correctly', () => {
    render(<FeeBreakdown amount={10000} />);

    expect(screen.getByText('$10000.00')).toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument();
    expect(screen.getByText('$9975.00 USDC')).toBeInTheDocument();
  });

  it('should display institutional messaging', () => {
    render(<FeeBreakdown amount={100} />);

    expect(screen.getByText('Institutional-Grade Infrastructure')).toBeInTheDocument();
    expect(screen.getByText('Traditional Wire')).toBeInTheDocument();
    expect(screen.getByText('Stellar Network')).toBeInTheDocument();
    expect(screen.getByText(/Powered by Stellar's global payment network/)).toBeInTheDocument();
  });

  it('should show settlement time messaging', () => {
    render(<FeeBreakdown amount={100} />);

    expect(screen.getByText(/Settles in 3-5 seconds/)).toBeInTheDocument();
    expect(screen.getByText(/1:1 USD backed/)).toBeInTheDocument();
    expect(screen.getByText(/Final amount guaranteed/)).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <FeeBreakdown amount={100} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should handle zero amounts gracefully', () => {
    render(<FeeBreakdown amount={0} />);

    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText('$0.01')).toBeInTheDocument();
    // Negative recipient amount should still render
    expect(screen.getByText('$-0.01 USDC')).toBeInTheDocument();
  });

  it('should display comparison with traditional wire transfers', () => {
    render(<FeeBreakdown amount={100} />);

    // Check traditional wire transfer info
    expect(screen.getByText('$15-45 fee • 1-3 business days')).toBeInTheDocument();
    
    // Check Stellar network info - using the actual calculated fee
    expect(screen.getByText('$0.50 fee • 3-5 seconds')).toBeInTheDocument();
  });
});