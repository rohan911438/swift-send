/**
 * Tests for DownloadReceiptButton component
 * Feature: transaction-receipt-generation
 * Property 12: For any transaction ID string, the DownloadReceiptButton rendered with that ID
 *   SHALL have aria-label === "Download receipt for transaction " + id
 * Validates: Requirements 4.1, 4.2, 4.3
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import * as fc from 'fast-check';
import { DownloadReceiptButton } from '../DownloadReceiptButton';
import type { Transaction } from '@/types';

// Mock the receiptGenerator module to avoid calling jsPDF
jest.mock('@/lib/receiptGenerator', () => ({
  generateAndDownloadTransactionReceipt: jest.fn(),
  generateAndDownloadRemittanceReceipt: jest.fn(),
  ReceiptGenerationError: class ReceiptGenerationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ReceiptGenerationError';
    }
  },
}));

// Mock sonner toast
jest.mock('sonner', () => ({ toast: { error: jest.fn() } }));

import {
  generateAndDownloadTransactionReceipt,
  generateAndDownloadRemittanceReceipt,
  ReceiptGenerationError,
} from '@/lib/receiptGenerator';
import { toast } from 'sonner';

const mockGenerateTransaction = generateAndDownloadTransactionReceipt as jest.MockedFunction<
  typeof generateAndDownloadTransactionReceipt
>;
const mockGenerateRemittance = generateAndDownloadRemittanceReceipt as jest.MockedFunction<
  typeof generateAndDownloadRemittanceReceipt
>;
const mockToastError = toast.error as jest.MockedFunction<typeof toast.error>;

const makeTransaction = (id: string): Transaction => ({
  id,
  type: 'send',
  amount: 100,
  fee: 1,
  recipientAmount: 99,
  recipientName: 'Alice',
  recipientPhone: '+1234567890',
  status: 'completed',
  timestamp: new Date('2024-01-15T10:00:00'),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGenerateTransaction.mockResolvedValue(undefined);
  mockGenerateRemittance.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('DownloadReceiptButton', () => {
  it('renders with "Download Receipt" text initially', () => {
    render(<DownloadReceiptButton transaction={makeTransaction('tx-001')} />);
    expect(screen.getByText('Download Receipt')).toBeInTheDocument();
  });

  it('sets aria-label correctly for a known transaction ID', () => {
    render(<DownloadReceiptButton transaction={makeTransaction('tx-abc-123')} />);
    expect(
      screen.getByRole('button', { name: 'Download receipt for transaction tx-abc-123' })
    ).toBeInTheDocument();
  });

  it('shows loading state (Loader2 + "Downloading...") while generating', async () => {
    // Make the generator hang so we can observe the loading state
    let resolveGenerate!: () => void;
    mockGenerateTransaction.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveGenerate = resolve;
      })
    );

    render(<DownloadReceiptButton transaction={makeTransaction('tx-loading')} />);
    const button = screen.getByRole('button');

    act(() => {
      fireEvent.click(button);
    });

    // While loading: button should be disabled and show "Downloading..."
    expect(await screen.findByText('Downloading...')).toBeInTheDocument();
    expect(button).toBeDisabled();

    // Resolve the promise and verify loading state clears
    await act(async () => {
      resolveGenerate();
    });

    await waitFor(() => {
      expect(screen.getByText('Download Receipt')).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });
  });

  it('calls toast.error with the correct message on ReceiptGenerationError', async () => {
    mockGenerateTransaction.mockRejectedValue(
      new ReceiptGenerationError('Failed to generate receipt')
    );

    render(<DownloadReceiptButton transaction={makeTransaction('tx-error')} />);
    const button = screen.getByRole('button');

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Receipt download failed. Please try again.'
      );
    });

    // Button should be re-enabled after error
    expect(button).not.toBeDisabled();
  });

  it('calls generateAndDownloadTransactionReceipt when transaction prop is provided', async () => {
    const tx = makeTransaction('tx-call-test');
    render(<DownloadReceiptButton transaction={tx} senderName="Bob" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    await waitFor(() => {
      expect(mockGenerateTransaction).toHaveBeenCalledWith(tx, 'Bob');
    });
  });

  it('calls generateAndDownloadRemittanceReceipt when remittanceTransfer prop is provided', async () => {
    const transfer = {
      id: 'rem-001',
      recipientName: 'Carol',
      amount: 200,
      currency: 'MXN',
      confirmationCode: 'SWJG7890',
      status: 'processing' as const,
      partnerName: 'MoneyGram',
      method: 'cash_pickup' as const,
      country: 'Mexico',
    };

    render(<DownloadReceiptButton remittanceTransfer={transfer} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    await waitFor(() => {
      expect(mockGenerateRemittance).toHaveBeenCalledWith(transfer);
    });
  });

  it('uses remittanceTransfer.id in aria-label when no transaction is provided', () => {
    const transfer = {
      id: 'rem-aria-test',
      recipientName: 'Dave',
      amount: 50,
      currency: 'PHP',
      confirmationCode: 'SWXX1234',
      status: 'completed' as const,
      partnerName: 'Western Union',
      method: 'mobile_money' as const,
      country: 'Philippines',
    };

    render(<DownloadReceiptButton remittanceTransfer={transfer} />);
    expect(
      screen.getByRole('button', { name: 'Download receipt for transaction rem-aria-test' })
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Property-based test — Property 12
// Feature: transaction-receipt-generation, Property 12:
// For any transaction ID string, the DownloadReceiptButton rendered with that ID
// SHALL have aria-label === "Download receipt for transaction " + id
// Validates: Requirements 4.1
// ---------------------------------------------------------------------------

describe('Property 12: aria-label pattern', () => {
  it('aria-label equals "Download receipt for transaction " + id for any transaction ID', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (id) => {
        const { unmount } = render(<DownloadReceiptButton transaction={makeTransaction(id)} />);
        const button = screen.getByRole('button');
        const ariaLabel = button.getAttribute('aria-label');
        unmount();
        return ariaLabel === `Download receipt for transaction ${id}`;
      })
    );
  });
});
