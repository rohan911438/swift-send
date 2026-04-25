/**
 * Pure helper functions for the Country Transfer UX feature.
 */

/**
 * Formats a delivery estimate from min/max minutes into a human-readable string.
 *
 * - Equal min/max → "~{n} min" (or "~{n} hrs" if n >= 60)
 * - Different min/max → "{min} – {max}" range string
 *
 * Requirements: 2.3, 2.4
 */
export function formatDeliveryEstimate(minMinutes: number, maxMinutes: number): string {
  if (minMinutes === maxMinutes) {
    const n = minMinutes;
    if (n >= 60) {
      const hrs = Math.round(n / 60);
      return `~${hrs} hrs`;
    }
    return `~${n} min`;
  }

  // Different min/max — build a range string
  const formatDuration = (minutes: number): string => {
    if (minutes >= 60) {
      const hrs = Math.round(minutes / 60);
      return `${hrs} hrs`;
    }
    return `${minutes} min`;
  };

  return `${formatDuration(minMinutes)} – ${formatDuration(maxMinutes)}`;
}

/**
 * Calculates the converted amount the recipient will receive.
 *
 * Formula: (amount - totalFee) × exchangeRate
 *
 * Requirements: 3.2
 */
export function convertAmount(
  amount: number,
  totalFee: number,
  exchangeRate: number
): number {
  return (amount - totalFee) * exchangeRate;
}

/**
 * Formats a numeric amount using the destination country's locale conventions.
 *
 * Uses Intl.NumberFormat with the provided locale.
 *
 * Requirements: 6.5
 */
export function formatConvertedAmount(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(amount);
}
