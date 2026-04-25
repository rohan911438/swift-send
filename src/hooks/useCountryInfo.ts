/**
 * React Query hook for fetching country-specific transfer information.
 * Used by the Send_Flow to display country rules, delivery estimates, and currency hints.
 */

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { CountryInfo } from '@/types/countryTransfer';

export interface UseCountryInfoResult {
  data: CountryInfo | null;
  isLoading: boolean;
  isError: boolean;
}

async function fetchCountryInfo(countryCode: string): Promise<CountryInfo> {
  const response = await apiFetch(`/countries/${countryCode}/transfer-info`);
  if (!response.ok) {
    throw new Error(`Failed to fetch country info for ${countryCode}: ${response.status}`);
  }
  return response.json() as Promise<CountryInfo>;
}

/**
 * Fetches and caches country-specific transfer metadata for the given country code.
 *
 * - Returns `{ data: null, isLoading: false, isError: false }` when `countryCode` is `null`
 *   (new recipient by email/phone — destination country unknown).
 * - Caches results with a 5-minute stale time.
 * - On error, sets `isError: true` and returns `data: null` (never throws to the component tree).
 */
export function useCountryInfo(countryCode: string | null): UseCountryInfoResult {
  const query = useQuery<CountryInfo, Error>({
    queryKey: ['countryInfo', countryCode],
    queryFn: () => fetchCountryInfo(countryCode!),
    enabled: countryCode !== null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // When countryCode is null, return the neutral "no-op" state immediately.
  if (countryCode === null) {
    return { data: null, isLoading: false, isError: false };
  }

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
