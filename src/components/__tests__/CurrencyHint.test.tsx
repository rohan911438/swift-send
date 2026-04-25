/**
 * Tests for CurrencyHint component.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.6, 3.7, 6.3, 6.5
 */
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { CurrencyHint } from '../CurrencyHint';

// ---------------------------------------------------------------------------
// Unit tests — 8.4
// ---------------------------------------------------------------------------

describe('CurrencyHint', () => {
  describe('null exchange rate', () => {
    it('does not render a converted amount when exchangeRate is null', () => {
      render(
        <CurrencyHint
          currencyCode="MXN"
          exchangeRate={null}
          amount={100}
          totalFee={1}
        />
      );
      expect(screen.queryByTestId('converted-amount')).not.toBeInTheDocument();
    });

    it('does not render a rate label when exchangeRate is null', () => {
      render(
        <CurrencyHint
          currencyCode="MXN"
          exchangeRate={null}
          amount={100}
          totalFee={1}
        />
      );
      expect(screen.queryByTestId('rate-label')).not.toBeInTheDocument();
    });

    it('still renders the currency code when exchangeRate is null', () => {
      render(
        <CurrencyHint
          currencyCode="MXN"
          exchangeRate={null}
          amount={100}
          totalFee={1}
        />
      );
      expect(screen.getByText('MXN')).toBeInTheDocument();
    });
  });

  describe('zero amount', () => {
    it('does not render a converted amount when amount is 0', () => {
      render(
        <CurrencyHint
          currencyCode="MXN"
          exchangeRate={17.25}
          amount={0}
          totalFee={0}
        />
      );
      expect(screen.queryByTestId('converted-amount')).not.toBeInTheDocument();
    });

    it('does not render a rate label when amount is 0', () => {
      render(
        <CurrencyHint
          currencyCode="MXN"
          exchangeRate={17.25}
          amount={0}
          totalFee={0}
        />
      );
      expect(screen.queryByTestId('rate-label')).not.toBeInTheDocument();
    });

    it('still renders the currency code when amount is 0', () => {
      render(
        <CurrencyHint
          currencyCode="MXN"
          exchangeRate={17.25}
          amount={0}
          totalFee={0}
        />
      );
      expect(screen.getByText('MXN')).toBeInTheDocument();
    });
  });

  describe('positive amount with rate', () => {
    it('renders the converted amount when amount > 0 and exchangeRate is set', () => {
      render(
        <CurrencyHint
          currencyCode="MXN"
          exchangeRate={17.25}
          amount={100}
          totalFee={1}
          locale="en-US"
        />
      );
      // (100 - 1) * 17.25 = 1707.75
      const el = screen.getByTestId('converted-amount');
      expect(el).toBeInTheDocument();
      expect(el.textContent).toContain('1,707.75');
    });

    it('renders the rate label when amount > 0 and exchangeRate is set', () => {
      render(
        <CurrencyHint
          currencyCode="MXN"
          exchangeRate={17.25}
          amount={100}
          totalFee={1}
        />
      );
      const label = screen.getByTestId('rate-label');
      expect(label).toBeInTheDocument();
      expect(label.textContent).toBe('1 USDC = 17.25 MXN');
    });

    it('wraps the converted amount in an aria-live="polite" region', () => {
      render(
        <CurrencyHint
          currencyCode="MXN"
          exchangeRate={17.25}
          amount={100}
          totalFee={1}
        />
      );
      const region = screen.getByTestId('converted-amount-region');
      expect(region).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('locale formatting', () => {
    it('formats the converted amount using es-MX locale (comma as thousands separator)', () => {
      render(
        <CurrencyHint
          currencyCode="MXN"
          exchangeRate={17.25}
          amount={100}
          totalFee={1}
          locale="es-MX"
        />
      );
      // es-MX uses comma as thousands separator and period as decimal
      const el = screen.getByTestId('converted-amount');
      const formatted = new Intl.NumberFormat('es-MX').format(1707.75);
      expect(el.textContent).toBe(formatted);
    });

    it('formats the converted amount using en-US locale (comma as thousands separator)', () => {
      render(
        <CurrencyHint
          currencyCode="PHP"
          exchangeRate={56}
          amount={50}
          totalFee={0.5}
          locale="en-US"
        />
      );
      // (50 - 0.5) * 56 = 2772
      const el = screen.getByTestId('converted-amount');
      const formatted = new Intl.NumberFormat('en-US').format(2772);
      expect(el.textContent).toBe(formatted);
    });

    it('defaults to en-US locale when locale prop is not provided', () => {
      render(
        <CurrencyHint
          currencyCode="MXN"
          exchangeRate={17.25}
          amount={100}
          totalFee={1}
        />
      );
      const el = screen.getByTestId('converted-amount');
      const formatted = new Intl.NumberFormat('en-US').format(1707.75);
      expect(el.textContent).toBe(formatted);
    });
  });
});

// ---------------------------------------------------------------------------
// Property-based test — Property 5
// **Validates: Requirements 3.3, 3.7**
// ---------------------------------------------------------------------------

describe('CurrencyHint — Property 5: suppresses converted amount when amount ≤ 0 or rate is null', () => {
  it('never renders data-testid="converted-amount" when amount <= 0 or exchangeRate is null', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // amount === 0, rate is positive
          fc.record({
            amount: fc.constant(0),
            exchangeRate: fc.float({ min: Math.fround(0.001), max: Math.fround(1000), noNaN: true }),
          }),
          // amount < 0, rate is positive
          fc.record({
            amount: fc.float({ max: Math.fround(-0.001), noNaN: true }),
            exchangeRate: fc.float({ min: Math.fround(0.001), max: Math.fround(1000), noNaN: true }),
          }),
          // amount > 0, rate is null
          fc.record({
            amount: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
            exchangeRate: fc.constant(null as null),
          })
        ),
        ({ amount, exchangeRate }) => {
          const { unmount, queryByTestId } = render(
            <CurrencyHint
              amount={amount}
              currencyCode="MXN"
              exchangeRate={exchangeRate}
              totalFee={0}
            />
          );
          const result = queryByTestId('converted-amount') === null;
          unmount();
          return result;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property-based test — Property 6
// **Validates: Requirements 3.6**
// ---------------------------------------------------------------------------

describe('CurrencyHint — Property 6: rate label format', () => {
  it('rate label matches "1 USDC = {rate} {currencyCode}" for any positive rate and valid currencyCode when amount > 0', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.001), max: Math.fround(10000), noNaN: true }),
        fc.stringMatching(/^[A-Z]{3}$/),
        (rate, currencyCode) => {
          const { unmount, getByTestId } = render(
            <CurrencyHint
              amount={100}
              currencyCode={currencyCode}
              exchangeRate={rate}
              totalFee={0}
            />
          );
          const label = getByTestId('rate-label').textContent ?? '';
          const result =
            label.includes('1 USDC =') && label.includes(currencyCode);
          unmount();
          return result;
        }
      ),
      { numRuns: 100 }
    );
  });
});
