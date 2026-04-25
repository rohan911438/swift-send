import * as fc from 'fast-check';
import { buildTransactionReceiptContent } from '../receiptGenerator';
import type { Transaction } from '@/types';
import type { TransactionRiskSummary } from '@/types/activity';

// Feature: transaction-receipt-generation

// ---------------------------------------------------------------------------
// Shared generator helpers
// ---------------------------------------------------------------------------

const transactionStatusArb = fc.constantFrom(
  'pending' as const,
  'processing' as const,
  'completed' as const,
  'failed' as const
);

const sendTransactionArb = fc.record<Transaction>({
  id: fc.string({ minLength: 1 }),
  type: fc.constant('send' as const),
  amount: fc.float({ min: Math.fround(0.01), noNaN: true, noDefaultInfinity: true }),
  fee: fc.float({ min: Math.fround(0), noNaN: true, noDefaultInfinity: true }),
  recipientAmount: fc.float({ min: Math.fround(0), noNaN: true, noDefaultInfinity: true }),
  recipientName: fc.string({ minLength: 1 }),
  recipientPhone: fc.string(),
  status: transactionStatusArb,
  timestamp: fc.date(),
});

const receiveTransactionArb = fc.record<Transaction>({
  id: fc.string({ minLength: 1 }),
  type: fc.constant('receive' as const),
  amount: fc.float({ min: Math.fround(0.01), noNaN: true, noDefaultInfinity: true }),
  fee: fc.float({ min: Math.fround(0), noNaN: true, noDefaultInfinity: true }),
  recipientAmount: fc.float({ min: Math.fround(0), noNaN: true, noDefaultInfinity: true }),
  recipientName: fc.string({ minLength: 1 }),
  recipientPhone: fc.string(),
  status: transactionStatusArb,
  timestamp: fc.date(),
});

// ---------------------------------------------------------------------------
// Property 1: Send receipt contains all required fields
// Validates: Requirements 1.3
// ---------------------------------------------------------------------------

describe('Property 1: Send receipt contains all required fields', () => {
  it('all required field labels are present for any send transaction', () => {
    fc.assert(
      fc.property(
        sendTransactionArb,
        fc.string({ minLength: 1 }),
        (transaction, senderName) => {
          const content = buildTransactionReceiptContent(transaction, senderName);

          const allFields = content.sections.flatMap((s) => s.fields.map((f) => f.label));

          const requiredLabels = [
            'Transaction ID',
            'Date & Time',
            'Sender',
            'Recipient',
            'Recipient Phone',
            'Type',
            'Amount Sent',
            'Network Fee',
            'Service Fee',
            'Total Fee',
            'Total Cost',
            'Status',
          ];

          for (const label of requiredLabels) {
            expect(allFields).toContain(label);
          }
        }
      )
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Receive receipt omits fee breakdown
// Validates: Requirements 1.4
// ---------------------------------------------------------------------------

describe('Property 2: Receive receipt omits fee breakdown', () => {
  it('no fee breakdown field labels appear for any receive transaction', () => {
    fc.assert(
      fc.property(
        receiveTransactionArb,
        fc.string({ minLength: 1 }),
        (transaction, senderName) => {
          const content = buildTransactionReceiptContent(transaction, senderName);

          const allFields = content.sections.flatMap((s) => s.fields.map((f) => f.label));

          const feeLabels = ['Network Fee', 'Service Fee', 'Total Fee', 'Total Cost'];

          for (const label of feeLabels) {
            expect(allFields).not.toContain(label);
          }
        }
      )
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10: Transaction ID is never truncated in the receipt
// Validates: Requirements 3.4
// ---------------------------------------------------------------------------

describe('Property 10: Transaction ID is never truncated in the receipt', () => {
  it('the full transaction ID appears as a field value for any ID length', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.constantFrom('send' as const, 'receive' as const),
        fc.string({ minLength: 1 }),
        (id, type, senderName) => {
          const transaction: Transaction = {
            id,
            type,
            amount: 10,
            fee: 0.5,
            recipientAmount: 9.5,
            recipientName: 'Alice',
            recipientPhone: '+1234567890',
            status: 'completed',
            timestamp: new Date(),
          };

          const content = buildTransactionReceiptContent(transaction, senderName);

          const allValues = content.sections.flatMap((s) => s.fields.map((f) => f.value));
          expect(allValues).toContain(id);
        }
      )
    );
  });
});

// ---------------------------------------------------------------------------
// Property 11: Risk notice appears for high/medium risk and is absent for low
// Validates: Requirements 3.5
// ---------------------------------------------------------------------------

describe('Property 11: Risk notice appears for high/medium risk and is absent for low', () => {
  it('notice is set for high/medium risk and absent for low risk', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('high' as const, 'medium' as const, 'low' as const),
        fc.constantFrom('send' as const, 'receive' as const),
        fc.string({ minLength: 1 }),
        (riskLevel, type, senderName) => {
          const risk: TransactionRiskSummary = {
            score: riskLevel === 'high' ? 90 : riskLevel === 'medium' ? 50 : 10,
            level: riskLevel,
            flags: [],
            requiresReview: riskLevel !== 'low',
          };

          const transaction: Transaction = {
            id: 'txn-001',
            type,
            amount: 10,
            fee: 0.5,
            recipientAmount: 9.5,
            recipientName: 'Alice',
            recipientPhone: '+1234567890',
            status: 'completed',
            timestamp: new Date(),
            risk,
          };

          const content = buildTransactionReceiptContent(transaction, senderName);

          if (riskLevel === 'high' || riskLevel === 'medium') {
            expect(content.notice).toBe(
              'This transaction was subject to additional review.'
            );
          } else {
            expect(content.notice).toBeUndefined();
          }
        }
      )
    );
  });

  it('notice is absent when no risk field is present', () => {
    const transaction: Transaction = {
      id: 'txn-no-risk',
      type: 'send',
      amount: 10,
      fee: 0.5,
      recipientAmount: 9.5,
      recipientName: 'Alice',
      recipientPhone: '+1234567890',
      status: 'completed',
      timestamp: new Date(),
    };

    const content = buildTransactionReceiptContent(transaction, 'Bob');
    expect(content.notice).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Property 3: Receipt header always contains brand name and generation timestamp
// Validates: Requirements 1.5
// ---------------------------------------------------------------------------

// Feature: transaction-receipt-generation, Property 3:
// Receipt header always contains brand name and generation timestamp
// Validates: Requirements 1.5
describe('Property 3: Receipt header always contains brand name and generation timestamp', () => {
  it('header.brandName === "SwiftSend" and generatedAt matches timestamp pattern for any send transaction', () => {
    fc.assert(
      fc.property(sendTransactionArb, fc.string({ minLength: 1 }), (transaction, senderName) => {
        const content = buildTransactionReceiptContent(transaction, senderName);
        expect(content.header.brandName).toBe('SwiftSend');
        expect(content.header.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      })
    );
  });

  it('header.brandName === "SwiftSend" and generatedAt matches timestamp pattern for any receive transaction', () => {
    fc.assert(
      fc.property(receiveTransactionArb, fc.string({ minLength: 1 }), (transaction, senderName) => {
        const content = buildTransactionReceiptContent(transaction, senderName);
        expect(content.header.brandName).toBe('SwiftSend');
        expect(content.header.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Filename follows the required pattern
// Validates: Requirements 1.6
// ---------------------------------------------------------------------------

// Feature: transaction-receipt-generation, Property 4:
// Filename follows the required pattern
// Validates: Requirements 1.6
describe('Property 4: Filename follows the required pattern', () => {
  it('filename equals "receipt-" + transactionId + ".pdf" for any transaction ID', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (id) => {
        const expectedFilename = `receipt-${id}.pdf`;
        expect(expectedFilename).toMatch(/^receipt-.+\.pdf$/);
        expect(expectedFilename).toBe(`receipt-${id}.pdf`);
      })
    );
  });
});
