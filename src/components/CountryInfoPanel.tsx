import { AlertTriangle, MapPin, Clock, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDeliveryEstimate } from '@/lib/countryTransferHelpers';
import type { CountryInfo, CashOutMethod } from '@/types/countryTransfer';

export interface CountryInfoPanelProps {
  countryInfo: CountryInfo | null;
  isLoading: boolean;
  isError: boolean;
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

const METHOD_LABELS: Record<CashOutMethod['type'], string> = {
  cash_pickup: 'Cash Pickup',
  bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money',
  home_delivery: 'Home Delivery',
};

function SkeletonLoader() {
  return (
    <div
      aria-label="Loading country information"
      aria-busy="true"
      className="bg-card rounded-xl p-5 shadow-card border border-border/50 space-y-4 animate-pulse"
    >
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-muted" />
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-3 bg-muted rounded w-1/5" />
        </div>
      </div>
      {/* Methods skeleton */}
      <div className="space-y-2">
        <div className="h-3 bg-muted rounded w-1/4" />
        <div className="h-10 bg-muted rounded" />
        <div className="h-10 bg-muted rounded" />
      </div>
      {/* Rules skeleton */}
      <div className="space-y-2">
        <div className="h-3 bg-muted rounded w-1/4" />
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-4 bg-muted rounded w-2/3" />
      </div>
    </div>
  );
}

export function CountryInfoPanel({ countryInfo, isLoading, isError }: CountryInfoPanelProps) {
  if (isLoading) {
    return <SkeletonLoader />;
  }

  if (isError) {
    return (
      <section
        aria-label="Country information"
        className="bg-card rounded-xl p-5 shadow-card border border-border/50"
      >
        <p className="text-sm text-muted-foreground">
          Country information is temporarily unavailable.
        </p>
      </section>
    );
  }

  if (!countryInfo) {
    return null;
  }

  const flagEmoji = getFlagEmoji(countryInfo.countryCode);

  return (
    <section
      aria-label={`Transfer information for ${countryInfo.countryName}`}
      className="bg-card rounded-xl p-5 shadow-card border border-border/50 space-y-5 w-full min-w-0"
    >
      {/* Country header */}
      <header className="flex items-center gap-3 min-w-0">
        <span
          className="text-3xl leading-none flex-shrink-0"
          aria-hidden="true"
          role="img"
        >
          {flagEmoji}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground truncate">
            {countryInfo.countryName}
          </h2>
          <p className="text-xs text-muted-foreground font-mono">
            {countryInfo.countryCode}
          </p>
        </div>
      </header>

      {/* Restricted corridor warning */}
      {countryInfo.isRestricted && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg bg-destructive/10 border border-destructive/30 p-4"
        >
          <AlertTriangle
            className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold text-destructive">
              Restricted Corridor
            </p>
            <p className="text-xs text-destructive/80 mt-0.5">
              Transfers to this destination are currently restricted. You cannot
              proceed with this transfer.
            </p>
          </div>
        </div>
      )}

      {/* Cash-out methods */}
      {countryInfo.cashOutMethods.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Available Cash-Out Methods
          </h3>
          <ul
            aria-label="Available cash-out methods"
            className="space-y-2"
          >
            {countryInfo.cashOutMethods.map((method, index) => (
              <li
                key={`${method.type}-${index}`}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-lg border border-border/50',
                  'bg-muted/30 px-4 py-3 min-w-0'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle
                    className="w-4 h-4 text-green-500 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {method.partnerName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {METHOD_LABELS[method.type]}
                    </p>
                  </div>
                </div>
                <div
                  className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0"
                  aria-label={`Delivery estimate: ${formatDeliveryEstimate(method.deliveryMinMinutes, method.deliveryMaxMinutes)}`}
                >
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{formatDeliveryEstimate(method.deliveryMinMinutes, method.deliveryMaxMinutes)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Compliance rules */}
      {countryInfo.complianceRules.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Transfer Requirements
          </h3>
          <ul
            aria-label="Compliance requirements"
            className="space-y-2"
          >
            {countryInfo.complianceRules.map((rule, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-foreground"
              >
                <MapPin
                  className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
