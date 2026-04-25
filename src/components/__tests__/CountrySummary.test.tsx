/**
 * Tests for CountrySummary component.
 *
 * Validates: Requirements 5.1, 5.2, 2.2, 2.6
 */
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { CountrySummary } from '../CountrySummary';
import type { CountryInfo, CashOutMethod } from '@/types/countryTransfer';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseCashOutMethod: CashOutMethod = {
  type: 'cash_pickup',
  partnerName: 'Elektra',
  deliveryMinMinutes: 15,
  deliveryMaxMinutes: 30,
};

const baseCountryInfo: CountryInfo = {
  countryCode: 'MX',
  countryName: 'Mexico',
  currencyCode: 'MXN',
  exchangeRate: 17.25,
  isRestricted: false,
  complianceRules: ['Government ID required for cash pickup'],
  cashOutMethods: [baseCashOutMethod],
};

// ---------------------------------------------------------------------------
// Unit tests — 10.3
// ---------------------------------------------------------------------------

describe('CountrySummary', () => {
  describe('country name and flag', () => {
    it('renders the country name', () => {
      render(
        <CountrySummary
          countryInfo={baseCountryInfo}
          selectedMethod={baseCashOutMethod}
          amount={100}
          totalFee={1}
        />
      );
      expect(screen.getByTestId('country-name')).toHaveTextContent('Mexico');
    });

    it('renders the flag emoji for the country code', () => {
      render(
        <CountrySummary
          countryInfo={baseCountryInfo}
          selectedMethod={baseCashOutMethod}
          amount={100}
          totalFee={1}
        />
      );
      // MX → 🇲🇽 (regional indicator M + X)
      const flagM = String.fromCodePoint(127397 + 'M'.charCodeAt(0));
      const flagX = String.fromCodePoint(127397 + 'X'.charCodeAt(0));
      const expectedFlag = flagM + flagX;
      expect(document.body.textContent).toContain(expectedFlag);
    });

    it('renders the ISO country code', () => {
      render(
        <CountrySummary
          countryInfo={baseCountryInfo}
          selectedMethod={baseCashOutMethod}
          amount={100}
          totalFee={1}
        />
      );
      expect(screen.getByText('MX')).toBeInTheDocument();
    });
  });

  describe('selected method', () => {
    it('renders the selected method partner name', () => {
      render(
        <CountrySummary
          countryInfo={baseCountryInfo}
          selectedMethod={baseCashOutMethod}
          amount={100}
          totalFee={1}
        />
      );
      expect(screen.getByTestId('method-partner-name')).toHaveTextContent('Elektra');
    });

    it('renders a different partner name when a different method is selected', () => {
      const bankMethod: CashOutMethod = {
        type: 'bank_transfer',
        partnerName: 'BBVA',
        deliveryMinMinutes: 60,
        deliveryMaxMinutes: 120,
      };
      render(
        <CountrySummary
          countryInfo={baseCountryInfo}
          selectedMethod={bankMethod}
          amount={100}
          totalFee={1}
        />
      );
      expect(screen.getByTestId('method-partner-name')).toHaveTextContent('BBVA');
    });
  });

  describe('delivery estimate', () => {
    it('renders the delivery estimate for equal min/max as "~{n} min"', () => {
      const method: CashOutMethod = {
        type: 'cash_pickup',
        partnerName: 'Elektra',
        deliveryMinMinutes: 15,
        deliveryMaxMinutes: 15,
      };
      render(
        <CountrySummary
          countryInfo={baseCountryInfo}
          selectedMethod={method}
          amount={100}
          totalFee={1}
        />
      );
      expect(screen.getByTestId('delivery-estimate')).toHaveTextContent('~15 min');
    });

    it('renders the delivery estimate range when min !== max', () => {
      const method: CashOutMethod = {
        type: 'bank_transfer',
        partnerName: 'BBVA',
        deliveryMinMinutes: 30,
        deliveryMaxMinutes: 120,
      };
      render(
        <CountrySummary
          countryInfo={baseCountryInfo}
          selectedMethod={method}
          amount={100}
          totalFee={1}
        />
      );
      expect(screen.getByTestId('delivery-estimate')).toHaveTextContent('30 min – 2 hrs');
    });
  });

  describe('currency hint', () => {
    it('renders the converted-amount-region (aria-live region)', () => {
      render(
        <CountrySummary
          countryInfo={baseCountryInfo}
          selectedMethod={baseCashOutMethod}
          amount={100}
          totalFee={1}
        />
      );
      expect(screen.getByTestId('converted-amount-region')).toBeInTheDocument();
    });

    it('renders the converted amount when amount > 0 and exchangeRate is set', () => {
      render(
        <CountrySummary
          countryInfo={baseCountryInfo}
          selectedMethod={baseCashOutMethod}
          amount={100}
          totalFee={1}
        />
      );
      // (100 - 1) * 17.25 = 1707.75
      expect(screen.getByTestId('converted-amount')).toBeInTheDocument();
    });

    it('does not render converted amount when exchangeRate is null', () => {
      const infoNoRate: CountryInfo = {
        ...baseCountryInfo,
        exchangeRate: null,
      };
      render(
        <CountrySummary
          countryInfo={infoNoRate}
          selectedMethod={baseCashOutMethod}
          amount={100}
          totalFee={1}
        />
      );
      expect(screen.queryByTestId('converted-amount')).not.toBeInTheDocument();
    });

    it('renders the currency code', () => {
      render(
        <CountrySummary
          countryInfo={baseCountryInfo}
          selectedMethod={baseCashOutMethod}
          amount={100}
          totalFee={1}
        />
      );
      expect(screen.getByText('MXN')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Property-based test — Property 10
// **Validates: Requirements 5.1, 5.2**
// ---------------------------------------------------------------------------

describe('CountrySummary — Property 10: confirm step renders all required summary elements', () => {
  it('renders country name, method partnerName, delivery estimate, and currency hint for any valid CountryInfo and CashOutMethod', () => {
    fc.assert(
      fc.property(
        fc.record({
          countryCode: fc.stringMatching(/^[A-Z]{2}$/),
          countryName: fc.string({ minLength: 1 }),
          currencyCode: fc.string({ minLength: 3, maxLength: 3 }),
          exchangeRate: fc.float({ min: Math.fround(0.001), max: Math.fround(1000), noNaN: true }),
          isRestricted: fc.constant(false),
          complianceRules: fc.array(fc.string({ minLength: 1 }), {
            minLength: 1,
            maxLength: 5,
          }),
          cashOutMethods: fc.array(
            fc.record({
              type: fc.constantFrom(
                'cash_pickup' as const,
                'bank_transfer' as const,
                'mobile_money' as const,
                'home_delivery' as const
              ),
              partnerName: fc.string({ minLength: 1 }),
              deliveryMinMinutes: fc.integer({ min: 1, max: 60 }),
              deliveryMaxMinutes: fc.integer({ min: 60, max: 240 }),
            }),
            { minLength: 1, maxLength: 3 }
          ),
        }),
        (countryInfo) => {
          const method = countryInfo.cashOutMethods[0];

          const { unmount } = render(
            <CountrySummary
              countryInfo={countryInfo}
              selectedMethod={method}
              amount={100}
              totalFee={0.5}
            />
          );

          const allTextContent = document.body.textContent ?? '';

          // Country name must be present
          expect(allTextContent).toContain(countryInfo.countryName);

          // Method partner name must be present
          expect(allTextContent).toContain(method.partnerName);

          // Delivery estimate element must be present
          const deliveryEl = document.querySelector('[data-testid="delivery-estimate"]');
          expect(deliveryEl).not.toBeNull();

          // Currency hint region must be present (aria-live region)
          const currencyRegion = document.querySelector('[data-testid="converted-amount-region"]');
          expect(currencyRegion).not.toBeNull();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
