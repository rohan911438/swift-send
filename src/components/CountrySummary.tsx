import { Clock } from 'lucide-react';
import { formatDeliveryEstimate } from '@/lib/countryTransferHelpers';
import { CurrencyHint } from '@/components/CurrencyHint';
import type { CountryInfo, CashOutMethod } from '@/types/countryTransfer';

export interface CountrySummaryProps {
  countryInfo: CountryInfo;
  selectedMethod: CashOutMethod;
  amount: number;
  totalFee: number;
}

/**
 * Derives a flag emoji from a two-letter ISO country code using Unicode regional indicators.
 * Each letter maps to a regional indicator symbol (A=🇦, B=🇧, etc.).
 */
function getFlagEmoji(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

/**
 * Displays a concise country summary on the confirm step.
 *
 * Renders:
 * - Country name and flag emoji
 * - Selected cash-out method partner name
 * - Delivery estimate for the selected method
 * - CurrencyHint with converted amount
 *
 * Requirements: 5.1, 2.2, 2.6
 */
export function CountrySummary({
  countryInfo,
  selectedMethod,
  amount,
  totalFee,
}: CountrySummaryProps) {
  const flagEmoji = getFlagEmoji(countryInfo.countryCode);
  const deliveryEstimate = formatDeliveryEstimate(
    selectedMethod.deliveryMinMinutes,
    selectedMethod.deliveryMaxMinutes
  );

  return (
    <section
      aria-label={`Transfer summary for ${countryInfo.countryName}`}
      className="bg-card rounded-xl p-5 shadow-card border border-border/50 space-y-4"
    >
      {/* Country header */}
      <div className="flex items-center gap-3">
        <span
          className="text-3xl leading-none flex-shrink-0"
          aria-hidden="true"
          role="img"
        >
          {flagEmoji}
        </span>
        <div>
          <h2
            className="text-base font-semibold text-foreground"
            data-testid="country-name"
          >
            {countryInfo.countryName}
          </h2>
          <p className="text-xs text-muted-foreground font-mono">
            {countryInfo.countryCode}
          </p>
        </div>
      </div>

      {/* Selected method */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
        <span
          className="text-sm font-medium text-foreground"
          data-testid="method-partner-name"
        >
          {selectedMethod.partnerName}
        </span>

        {/* Delivery estimate */}
        <div
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          aria-label={`Delivery estimate: ${deliveryEstimate}`}
          data-testid="delivery-estimate"
        >
          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{deliveryEstimate}</span>
        </div>
      </div>

      {/* Currency hint */}
      <CurrencyHint
        currencyCode={countryInfo.currencyCode}
        exchangeRate={countryInfo.exchangeRate}
        amount={amount}
        totalFee={totalFee}
      />
    </section>
  );
}
