import { render, screen } from '@testing-library/react';
import { TransactionItem } from '../TransactionItem';
import type { Transaction } from '@/types';

function buildTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    type: 'send',
    amount: 50,
    fee: 1.5,
    recipientAmount: 48.5,
    recipientName: 'Jane Doe',
    recipientPhone: '+1234567890',
    status: 'completed',
    timestamp: new Date('2026-04-26T10:00:00.000Z'),
    ...overrides,
  };
}

describe('TransactionItem detailed metadata (#92)', () => {
  it('shows the metadata block when notes are present', () => {
    render(
      <TransactionItem
        transaction={buildTransaction({ notes: 'Rent for April 🏡' })}
        showDetailedView
        senderName="Sender"
      />,
    );
    expect(screen.getByTestId('transaction-metadata')).toBeInTheDocument();
    expect(screen.getByTestId('transaction-metadata-notes')).toHaveTextContent(
      'Rent for April 🏡',
    );
  });

  it('renders the category alongside notes', () => {
    render(
      <TransactionItem
        transaction={buildTransaction({
          notes: 'Birthday gift',
          category: 'Family support',
        })}
        showDetailedView
        senderName="Sender"
      />,
    );
    expect(screen.getByTestId('transaction-metadata-category')).toHaveTextContent(
      'Family support',
    );
  });

  it('omits the metadata block entirely when no metadata is present', () => {
    render(
      <TransactionItem
        transaction={buildTransaction()}
        showDetailedView
        senderName="Sender"
      />,
    );
    expect(screen.queryByTestId('transaction-metadata')).not.toBeInTheDocument();
  });

  it('renders metadata even when the transaction has no fraud risk flags', () => {
    // Regression: previously notes only rendered inside the risk block,
    // so a non-risky transaction with notes leaked them silently.
    render(
      <TransactionItem
        transaction={buildTransaction({
          notes: 'Tuition fees',
          category: 'Education',
        })}
        showDetailedView
        senderName="Sender"
      />,
    );
    expect(screen.getByTestId('transaction-metadata-notes')).toBeInTheDocument();
    expect(screen.getByTestId('transaction-metadata-category')).toBeInTheDocument();
  });

  it('shows exchange-rate context when destination currency + rate are set', () => {
    render(
      <TransactionItem
        transaction={buildTransaction({
          exchangeRate: 1.0824,
          destinationCurrency: 'EUR',
        })}
        showDetailedView
        senderName="Sender"
      />,
    );
    const block = screen.getByTestId('transaction-metadata');
    expect(block).toHaveTextContent('1 USDC = 1.0824 EUR');
    expect(block).toHaveTextContent('EUR');
  });

  it('shows explorer link when tx hash exists', () => {
    render(
      <TransactionItem
        transaction={buildTransaction({
          txHash: 'abc123hashxyz987654',
        })}
        showDetailedView
        senderName="Sender"
      />,
    );

    expect(screen.getByText('Open in Stellar Explorer')).toBeInTheDocument();
    expect(screen.getByText(/Hash:/)).toBeInTheDocument();
  });
});
