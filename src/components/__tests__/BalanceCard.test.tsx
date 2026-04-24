import { render, screen, fireEvent } from '@testing-library/react';
import { BalanceCard } from '../BalanceCard';

describe('BalanceCard Component', () => {
  const defaultProps = {
    usdcBalance: 1234.56,
    localCurrency: 'USD',
    exchangeRate: 1,
  };

  it('should render balance correctly', () => {
    render(<BalanceCard {...defaultProps} />);

    expect(screen.getByText('1,234.56')).toBeInTheDocument();
    expect(screen.getByText('USDC Balance')).toBeInTheDocument();
  });

  it('should handle zero balance', () => {
    render(<BalanceCard {...defaultProps} usdcBalance={0} />);

    expect(screen.getByText('0.00')).toBeInTheDocument();
  });

  it('should handle large balances with proper formatting', () => {
    render(<BalanceCard {...defaultProps} usdcBalance={1000000.99} />);

    expect(screen.getByText('1,000,000.99')).toBeInTheDocument();
  });

  it('should handle small decimal balances', () => {
    render(<BalanceCard {...defaultProps} usdcBalance={0.01} />);

    expect(screen.getByText('0.01')).toBeInTheDocument();
  });

  it('should show/hide balance when eye icon is clicked', () => {
    render(<BalanceCard {...defaultProps} />);

    const toggleButton = screen.getByLabelText('Hide balance');
    fireEvent.click(toggleButton);

    expect(screen.getByText('••••••')).toBeInTheDocument();
    expect(screen.getByLabelText('Show balance')).toBeInTheDocument();
  });

  it('should display FDIC protection message', () => {
    render(<BalanceCard {...defaultProps} />);

    expect(screen.getByText(/FDIC protected/)).toBeInTheDocument();
  });

  it('should show Stellar network indicator', () => {
    render(<BalanceCard {...defaultProps} />);

    expect(screen.getByText('Stellar Network')).toBeInTheDocument();
  });

  it('should handle negative balances gracefully', () => {
    render(<BalanceCard {...defaultProps} usdcBalance={-10.50} />);

    expect(screen.getByText('-10.50')).toBeInTheDocument();
  });

  it('should show fiat equivalent for non-USD currencies', () => {
    render(<BalanceCard {...defaultProps} localCurrency="EUR" exchangeRate={0.85} />);

    expect(screen.getByText(/≈ €1,049.38 EUR/)).toBeInTheDocument();
  });

  it('should not show fiat equivalent for USDC currency', () => {
    render(<BalanceCard {...defaultProps} localCurrency="USDC" />);

    expect(screen.queryByText(/≈/)).not.toBeInTheDocument();
  });
});