/**
 * Shared types for the Country Transfer UX feature.
 * Used by both frontend components and backend services.
 */

export interface CashOutMethod {
  type: 'cash_pickup' | 'bank_transfer' | 'mobile_money' | 'home_delivery';
  partnerName: string;
  deliveryMinMinutes: number;
  deliveryMaxMinutes: number;
}

export interface CountryInfo {
  countryCode: string;           // "MX"
  countryName: string;           // "Mexico"
  currencyCode: string;          // "MXN"
  exchangeRate: number | null;   // null if unavailable
  rateStaleAt?: string;          // ISO 8601 timestamp when rate was last refreshed
  isRestricted: boolean;
  complianceRules: string[];
  cashOutMethods: CashOutMethod[];
}

export interface RateCacheEntry {
  rate: number;
  cachedAt: number;   // Date.now() timestamp
}
