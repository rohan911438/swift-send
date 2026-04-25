/**
 * Tests for countryTransferHelpers.ts
 *
 * Includes both unit tests (example-based) and property-based tests (fast-check).
 */

import * as fc from 'fast-check';
import {
  formatDeliveryEstimate,
  convertAmount,
  formatConvertedAmount,
} from '../countryTransferHelpers';

// ---------------------------------------------------------------------------
// Unit tests — formatDeliveryEstimate
// ---------------------------------------------------------------------------

describe('formatDeliveryEstimate — unit tests', () => {
  it('returns "~0 min" for equal min/max of 0', () => {
    expect(formatDeliveryEstimate(0, 0)).toBe('~0 min');
  });

  it('returns "~15 min" for equal min/max of 15', () => {
    expect(formatDeliveryEstimate(15, 15)).toBe('~15 min');
  });

  it('returns "~1 hrs" for equal min/max of 60', () => {
    expect(formatDeliveryEstimate(60, 60)).toBe('~1 hrs');
  });

  it('returns "~2 hrs" for equal min/max of 120', () => {
    expect(formatDeliveryEstimate(120, 120)).toBe('~2 hrs');
  });

  it('returns a range string for different min/max (both < 60)', () => {
    expect(formatDeliveryEstimate(15, 30)).toBe('15 min – 30 min');
  });

  it('returns a range string for different min/max (min < 60, max >= 60)', () => {
    expect(formatDeliveryEstimate(15, 120)).toBe('15 min – 2 hrs');
  });

  it('returns a range string for different min/max (both >= 60)', () => {
    expect(formatDeliveryEstimate(60, 120)).toBe('1 hrs – 2 hrs');
  });
});

// ---------------------------------------------------------------------------
// Unit tests — convertAmount
// ---------------------------------------------------------------------------

describe('convertAmount — unit tests', () => {
  it('computes (amount - fee) * rate correctly', () => {
    expect(convertAmount(100, 2, 17.25)).toBeCloseTo(98 * 17.25, 9);
  });

  it('handles zero fee', () => {
    expect(convertAmount(50, 0, 10)).toBeCloseTo(500, 9);
  });

  it('handles small fee close to amount', () => {
    const result = convertAmount(10, 9.99, 2);
    expect(result).toBeCloseTo(0.01 * 2, 9);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — formatConvertedAmount
// ---------------------------------------------------------------------------

describe('formatConvertedAmount — unit tests', () => {
  it('formats a number with en-US locale', () => {
    const result = formatConvertedAmount(1234.56, 'en-US');
    expect(result).toBe(new Intl.NumberFormat('en-US').format(1234.56));
  });

  it('formats a number with es-MX locale', () => {
    const result = formatConvertedAmount(1234.56, 'es-MX');
    expect(result).toBe(new Intl.NumberFormat('es-MX').format(1234.56));
  });
});

// ---------------------------------------------------------------------------
// Property 2 — Delivery estimate formatting: equal min/max
// Validates: Requirements 2.4
// ---------------------------------------------------------------------------

describe('Property 2: formatDeliveryEstimate — equal min/max', () => {
  /**
   * **Validates: Requirements 2.4**
   *
   * For any non-negative integer n, formatDeliveryEstimate(n, n) should start
   * with "~" and not contain "–".
   */
  it('always starts with "~" and never contains "–" when min === max', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        (n) => {
          const result = formatDeliveryEstimate(n, n);
          return result.startsWith('~') && !result.includes('–');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3 — Delivery estimate consistency through the flow
// Validates: Requirements 2.6
// ---------------------------------------------------------------------------

describe('Property 3: formatDeliveryEstimate — consistency', () => {
  /**
   * **Validates: Requirements 2.6**
   *
   * For any CashOutMethod, the estimate string is identical when called twice
   * with the same args (pure function, no side effects).
   */
  it('returns the same string on repeated calls with the same arguments', () => {
    fc.assert(
      fc.property(
        fc.record({
          type: fc.constantFrom(
            'cash_pickup',
            'bank_transfer',
            'mobile_money',
            'home_delivery'
          ),
          partnerName: fc.string({ minLength: 1 }),
          deliveryMinMinutes: fc.integer({ min: 0, max: 1440 }),
          deliveryMaxMinutes: fc.integer({ min: 0, max: 1440 }),
        }),
        (method) => {
          const first = formatDeliveryEstimate(
            method.deliveryMinMinutes,
            method.deliveryMaxMinutes
          );
          const second = formatDeliveryEstimate(
            method.deliveryMinMinutes,
            method.deliveryMaxMinutes
          );
          return first === second;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4 — Currency conversion formula correctness
// Validates: Requirements 3.2
// ---------------------------------------------------------------------------

describe('Property 4: convertAmount — formula correctness', () => {
  /**
   * **Validates: Requirements 3.2**
   *
   * For any amount, fee (< amount), rate: result equals (amount - fee) * rate
   * within floating-point tolerance (1e-9).
   */
  it('equals (amount - fee) * rate within 1e-9 tolerance', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 10000, noNaN: true }),
        fc.double({ min: 0, max: 9999, noNaN: true }),
        fc.double({ min: 0.001, max: 1000, noNaN: true }),
        (amount, fee, rate) => {
          fc.pre(fee < amount);
          const result = convertAmount(amount, fee, rate);
          return Math.abs(result - (amount - fee) * rate) < 1e-9;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 12 — Locale-aware currency formatting
// Validates: Requirements 6.5
// ---------------------------------------------------------------------------

describe('Property 12: formatConvertedAmount — locale-aware formatting', () => {
  /**
   * **Validates: Requirements 6.5**
   *
   * For any amount and locale from the supported set, the formatted output
   * matches what Intl.NumberFormat produces for that locale.
   */
  it('produces output consistent with Intl.NumberFormat for each supported locale', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 100000, noNaN: true }),
        fc.constantFrom('es-MX', 'fil-PH', 'es-GT', 'es-SV', 'en-US'),
        (amount, locale) => {
          const formatted = formatConvertedAmount(amount, locale);
          const expected = new Intl.NumberFormat(locale).format(amount);
          return formatted === expected;
        }
      ),
      { numRuns: 100 }
    );
  });
});
