import * as fc from 'fast-check';
import {
  buildRemittanceReceiptContent,
  type RemittanceReceiptInput,
} from '../receiptGenerator';

// Feature: transaction-receipt-generation

// ---------------------------------------------------------------------------
// Shared generator helpers
// ---------------------------------------------------------------------------

const remittanceStatusArb = fc.constantFrom(
  'processing' as const,
  'ready_for_pickup' as const,
  'completed' as const
);

const transferMethodArb = fc.constantFrom(
  'cash_pickup' as const,
  'bank_transfer' as const,
  'mobile_money' as const,
  'home_delivery' as const
);

const remittanceInputArb = fc.record<RemittanceReceiptInput>({
  id: fc.string({ minLength: 1 }),
  recipientName: fc.string({ minLength: 1 }),
  amount: fc.float({ min: Math.fround(0.01), noNaN: true, noDefaultInfinity: true }),
  currency: fc.string({ minLength: 1 }),
  confirmationCode: fc.string({ minLength: 1 }),
  status: remittanceStatusArb,
  partnerName: fc.string({ minLength: 1 }),
  method: transferMethodArb,
  country: fc.string({ minLength: 1 }),
});

// ---------------------------------------------------------------------------
// Property 5: Remittance receipt contains all required fields
// Validates: Requirements 2.3
// ---------------------------------------------------------------------------

describe('Property 5: Remittance receipt contains all required fields', () => {
  it('all required field labels are present for any remittance input', () => {
    fc.assert(
      fc.property(remittanceInputArb, (transfer) => {
        const content = buildRemittanceReceiptContent(transfer);

        const allFieldLabels = content.sections.flatMap((s) => s.fields.map((f) => f.label));
        const allSectionTitles = content.sections
          .map((s) => s.title)
          .filter((t): t is string => t !== undefined);

        const requiredFieldLabels = [
          'Transfer ID',
          'Recipient Name',
          'Destination Country',
          'Transfer Method',
          'Partner',
          'Amount Sent',
          'Destination Currency',
          'Status',
        ];

        for (const label of requiredFieldLabels) {
          expect(allFieldLabels).toContain(label);
        }

        // Confirmation code must appear either as a field label or as a section title
        const hasConfirmationCodeField = allFieldLabels.includes('Confirmation Code') ||
          allFieldLabels.includes('Code');
        const hasConfirmationCodeSection = allSectionTitles.includes('Confirmation Code');
        expect(hasConfirmationCodeField || hasConfirmationCodeSection).toBe(true);
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: Ready-for-pickup receipts highlight the confirmation code
// Validates: Requirements 2.4
// ---------------------------------------------------------------------------

describe('Property 6: Ready-for-pickup receipts highlight the confirmation code', () => {
  it('a highlighted section exists and contains the confirmation code for ready_for_pickup', () => {
    const readyForPickupInputArb = fc.record<RemittanceReceiptInput>({
      id: fc.string({ minLength: 1 }),
      recipientName: fc.string({ minLength: 1 }),
      amount: fc.float({ min: Math.fround(0.01), noNaN: true, noDefaultInfinity: true }),
      currency: fc.string({ minLength: 1 }),
      confirmationCode: fc.string({ minLength: 1 }),
      status: fc.constant('ready_for_pickup' as const),
      partnerName: fc.string({ minLength: 1 }),
      method: transferMethodArb,
      country: fc.string({ minLength: 1 }),
    });

    fc.assert(
      fc.property(readyForPickupInputArb, (transfer) => {
        const content = buildRemittanceReceiptContent(transfer);

        // There must be at least one highlighted section
        const highlightedSections = content.sections.filter((s) => s.highlighted === true);
        expect(highlightedSections.length).toBeGreaterThan(0);

        // The highlighted section must contain the confirmation code value
        const highlightedFieldValues = highlightedSections.flatMap((s) =>
          s.fields.map((f) => f.value)
        );
        expect(highlightedFieldValues).toContain(transfer.confirmationCode);
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3 (remittance): Receipt header always contains brand name and generation timestamp
// Validates: Requirements 1.5
// ---------------------------------------------------------------------------

// Feature: transaction-receipt-generation, Property 3 (remittance):
// Receipt header always contains brand name and generation timestamp
describe('Property 3 (remittance): Receipt header always contains brand name and generation timestamp', () => {
  it('header.brandName === "SwiftSend" and generatedAt matches timestamp pattern for any remittance input', () => {
    fc.assert(
      fc.property(remittanceInputArb, (transfer) => {
        const content = buildRemittanceReceiptContent(transfer);
        expect(content.header.brandName).toBe('SwiftSend');
        expect(content.header.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      })
    );
  });
});
