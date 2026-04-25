/**
 * Tests for CountryInfoPanel component.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 6.1, 6.2, 6.4
 */
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { CountryInfoPanel } from '../CountryInfoPanel';
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
// Unit tests
// ---------------------------------------------------------------------------

describe('CountryInfoPanel', () => {
  describe('loading state', () => {
    it('renders a skeleton loader while isLoading is true', () => {
      render(
        <CountryInfoPanel countryInfo={null} isLoading={true} isError={false} />
      );
      // The skeleton container has aria-busy="true"
      expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    });

    it('does not render country name while loading', () => {
      render(
        <CountryInfoPanel countryInfo={baseCountryInfo} isLoading={true} isError={false} />
      );
      expect(screen.queryByText('Mexico')).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('renders fallback message when isError is true', () => {
      render(
        <CountryInfoPanel countryInfo={null} isLoading={false} isError={true} />
      );
      expect(
        screen.getByText('Country information is temporarily unavailable.')
      ).toBeInTheDocument();
    });

    it('does not render country data when isError is true', () => {
      render(
        <CountryInfoPanel countryInfo={baseCountryInfo} isLoading={false} isError={true} />
      );
      expect(screen.queryByText('Mexico')).not.toBeInTheDocument();
    });
  });

  describe('restricted corridor warning', () => {
    it('renders role="alert" when isRestricted is true', () => {
      const restrictedInfo: CountryInfo = {
        ...baseCountryInfo,
        isRestricted: true,
        cashOutMethods: [],
      };
      render(
        <CountryInfoPanel countryInfo={restrictedInfo} isLoading={false} isError={false} />
      );
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('does not render role="alert" when isRestricted is false', () => {
      render(
        <CountryInfoPanel countryInfo={baseCountryInfo} isLoading={false} isError={false} />
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows "Restricted Corridor" text in the alert', () => {
      const restrictedInfo: CountryInfo = {
        ...baseCountryInfo,
        isRestricted: true,
        cashOutMethods: [],
      };
      render(
        <CountryInfoPanel countryInfo={restrictedInfo} isLoading={false} isError={false} />
      );
      expect(screen.getByText('Restricted Corridor')).toBeInTheDocument();
    });
  });

  describe('normal state', () => {
    it('renders country name and ISO code', () => {
      render(
        <CountryInfoPanel countryInfo={baseCountryInfo} isLoading={false} isError={false} />
      );
      expect(screen.getByText('Mexico')).toBeInTheDocument();
      expect(screen.getByText('MX')).toBeInTheDocument();
    });

    it('renders each cash-out method partner name', () => {
      const info: CountryInfo = {
        ...baseCountryInfo,
        cashOutMethods: [
          { type: 'cash_pickup', partnerName: 'Elektra', deliveryMinMinutes: 15, deliveryMaxMinutes: 30 },
          { type: 'bank_transfer', partnerName: 'BBVA', deliveryMinMinutes: 60, deliveryMaxMinutes: 120 },
        ],
      };
      render(
        <CountryInfoPanel countryInfo={info} isLoading={false} isError={false} />
      );
      expect(screen.getByText('Elektra')).toBeInTheDocument();
      expect(screen.getByText('BBVA')).toBeInTheDocument();
    });

    it('renders formatted delivery estimate for each method', () => {
      const info: CountryInfo = {
        ...baseCountryInfo,
        cashOutMethods: [
          { type: 'cash_pickup', partnerName: 'Elektra', deliveryMinMinutes: 15, deliveryMaxMinutes: 15 },
        ],
      };
      render(
        <CountryInfoPanel countryInfo={info} isLoading={false} isError={false} />
      );
      // Equal min/max → "~15 min"
      expect(screen.getByText('~15 min')).toBeInTheDocument();
    });

    it('renders delivery estimate range when min !== max', () => {
      const info: CountryInfo = {
        ...baseCountryInfo,
        cashOutMethods: [
          { type: 'bank_transfer', partnerName: 'BBVA', deliveryMinMinutes: 30, deliveryMaxMinutes: 120 },
        ],
      };
      render(
        <CountryInfoPanel countryInfo={info} isLoading={false} isError={false} />
      );
      expect(screen.getByText('30 min – 2 hrs')).toBeInTheDocument();
    });

    it('renders each compliance rule as a plain-language statement', () => {
      const info: CountryInfo = {
        ...baseCountryInfo,
        complianceRules: [
          'Government ID required for cash pickup',
          'Maximum transfer limit: $500 per day',
        ],
      };
      render(
        <CountryInfoPanel countryInfo={info} isLoading={false} isError={false} />
      );
      expect(screen.getByText('Government ID required for cash pickup')).toBeInTheDocument();
      expect(screen.getByText('Maximum transfer limit: $500 per day')).toBeInTheDocument();
    });

    it('renders nothing when countryInfo is null and not loading/error', () => {
      const { container } = render(
        <CountryInfoPanel countryInfo={null} isLoading={false} isError={false} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('uses semantic section landmark', () => {
      render(
        <CountryInfoPanel countryInfo={baseCountryInfo} isLoading={false} isError={false} />
      );
      expect(
        screen.getByRole('region', { name: /Transfer information for Mexico/i })
      ).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Property-based test — Property 1
// **Validates: Requirements 1.1, 1.2, 1.3, 2.1**
// ---------------------------------------------------------------------------

describe('CountryInfoPanel — Property 1: renders complete country data', () => {
  it('displays country name, ISO code, every cash-out method, and every compliance rule for any valid CountryInfo', () => {
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
              deliveryMinMinutes: fc.integer({ min: 0, max: 1440 }),
              deliveryMaxMinutes: fc.integer({ min: 0, max: 1440 }),
            }),
            { minLength: 1, maxLength: 4 }
          ),
        }),
        (countryInfo) => {
          const { unmount } = render(
            <CountryInfoPanel
              countryInfo={countryInfo}
              isLoading={false}
              isError={false}
            />
          );

          // Country name must be present (use raw textContent to handle whitespace-only strings)
          const allTextContent = document.body.textContent ?? '';
          expect(allTextContent).toContain(countryInfo.countryName);

          // ISO code must be present
          expect(allTextContent).toContain(countryInfo.countryCode);

          // Every partner name must be present
          for (const method of countryInfo.cashOutMethods) {
            expect(allTextContent).toContain(method.partnerName);
          }

          // Every compliance rule must be present
          for (const rule of countryInfo.complianceRules) {
            expect(allTextContent).toContain(rule);
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
