import { convertAmount, formatConvertedAmount } from '@/lib/countryTransferHelpers';

export interface CurrencyHintProps {
  currencyCode: string | null;
  exchangeRate: number | null;
  amount: number;
  totalFee: number;
  locale?: string;
}

/**
 * Displays a currency hint inline during amount entry.
 *
 * - Shows only the currency code when exchangeRate is null or amount <= 0.
 * - Shows the converted recipient amount and rate label when amount > 0 and
 *   exchangeRate is available.
 * - Wraps the converted amount in an aria-live="polite" region.
 * - Formats numbers using the destination locale (defaults to 'en-US').
 *
 * Requirements: 3.1, 3.2, 3.3, 3.6, 3.7, 6.3, 6.5
 */
export function CurrencyHint({
  currencyCode,
  exchangeRate,
  amount,
  totalFee,
  locale = 'en-US',
}: CurrencyHintProps) {
  const showConversion = amount > 0 && exchangeRate !== null;

  return (
    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
      {/* Currency code — always shown when available */}
      {currencyCode && (
        <span className="font-medium text-foreground">{currencyCode}</span>
      )}

      {/* Converted amount — only shown when amount > 0 and rate is available */}
      <div aria-live="polite" data-testid="converted-amount-region">
        {showConversion && (
          <span data-testid="converted-amount" className="text-base font-semibold text-foreground">
            {formatConvertedAmount(
              convertAmount(amount, totalFee, exchangeRate as number),
              locale
            )}
          </span>
        )}
      </div>

      {/* Rate label — only shown when conversion is active */}
      {showConversion && (
        <span data-testid="rate-label" className="text-xs text-muted-foreground">
          1 USDC = {exchangeRate} {currencyCode}
        </span>
      )}
    </div>
  );
}
