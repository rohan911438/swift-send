import * as fc from 'fast-check';
import {
  formatReceiptAmount,
  formatReceiptDate,
  formatExchangeRate,
} from '../receiptGenerator';

// Feature: transaction-receipt-generation

describe('formatReceiptAmount', () => {
  // Property 7: Monetary amounts always have exactly 2 decimal places
  // Validates: Requirements 3.1
  it('Property 7: always produces exactly 2 decimal places for any finite number', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        (amount) => {
          const result = formatReceiptAmount(amount);
          // Allow optional leading minus for negative amounts
          expect(result).toMatch(/^-?\d+\.\d{2}$/);
        }
      )
    );
  });

  it('Property 7 (with currency): always produces exactly 2 decimal places with currency suffix', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        fc.stringMatching(/^[A-Z]{3}$/),
        (amount, currency) => {
          const result = formatReceiptAmount(amount, currency);
          // Allow optional leading minus for negative amounts
          expect(result).toMatch(/^-?\d+\.\d{2}(?: [A-Z]+)?$/);
        }
      )
    );
  });

  it('returns "0.00" for NaN', () => {
    expect(formatReceiptAmount(NaN)).toBe('0.00');
  });

  it('returns "0.00" for Infinity', () => {
    expect(formatReceiptAmount(Infinity)).toBe('0.00');
  });

  it('returns "0.00" for -Infinity', () => {
    expect(formatReceiptAmount(-Infinity)).toBe('0.00');
  });

  it('returns "0.00 USD" for NaN with currency', () => {
    expect(formatReceiptAmount(NaN, 'USD')).toBe('0.00 USD');
  });

  it('formats a known amount correctly', () => {
    expect(formatReceiptAmount(100)).toBe('100.00');
    expect(formatReceiptAmount(100, 'MXN')).toBe('100.00 MXN');
    expect(formatReceiptAmount(1.5)).toBe('1.50');
    expect(formatReceiptAmount(0)).toBe('0.00');
  });
});

describe('formatReceiptDate', () => {
  // Property 8: Date formatting always produces the correct ISO 8601 pattern
  // Validates: Requirements 3.2
  it('Property 8: always matches YYYY-MM-DD HH:mm:ss pattern for any Date', () => {
    // Constrain to years 1000–9999 in local time, which is the realistic "YYYY" range.
    // fc.date() can generate dates in years < 1000 (3-digit years) or > 9999 (5-digit years
    // due to timezone offsets), both outside the "YYYY" convention.
    const minDate = new Date('1000-01-01T12:00:00.000Z');
    const maxDate = new Date('9999-12-30T11:59:59.999Z');
    fc.assert(
      fc.property(
        fc.date({ min: minDate, max: maxDate }),
        (date) => {
          const result = formatReceiptDate(date);
          expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
        }
      )
    );
  });

  it('formats a known date correctly using local timezone parts', () => {
    // Construct a date using local time parts to avoid timezone issues in tests
    const date = new Date(2024, 6, 15, 14, 32, 7); // July 15, 2024 14:32:07 local
    const result = formatReceiptDate(date);
    expect(result).toBe('2024-07-15 14:32:07');
  });

  it('zero-pads single-digit month, day, hours, minutes, seconds', () => {
    const date = new Date(2024, 0, 5, 9, 3, 1); // Jan 5, 2024 09:03:01 local
    const result = formatReceiptDate(date);
    expect(result).toBe('2024-01-05 09:03:01');
  });
});

describe('formatExchangeRate', () => {
  // Property 9: Exchange rate formatting follows the required pattern
  // Validates: Requirements 3.3
  it('Property 9: always starts with "1 USD = " and ends with the currency string', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.0001, noNaN: true, noDefaultInfinity: true }),
        fc.string({ minLength: 1 }),
        (rate, currency) => {
          const result = formatExchangeRate(rate, currency);
          expect(result.startsWith('1 USD = ')).toBe(true);
          expect(result.endsWith(currency)).toBe(true);
        }
      )
    );
  });

  it('formats a known rate correctly', () => {
    expect(formatExchangeRate(17.25, 'MXN')).toBe('1 USD = 17.25 MXN');
    expect(formatExchangeRate(1.08, 'EUR')).toBe('1 USD = 1.08 EUR');
  });
});
