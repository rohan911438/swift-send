import { useState, useEffect } from 'react';

const CACHE_KEY = 'swift_send_fx_rates';
const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour
const POLL_INTERVAL = 30 * 1000; // 30 seconds

interface FxRates {
  [key: string]: number;
}

interface CacheData {
  rates: FxRates;
  timestamp: number;
}

const DEFAULT_RATES: FxRates = {
  USD: 1.0,
  MXN: 17.25,
  PHP: 56.5,
  GTQ: 7.85,
  EUR: 0.92,
  GBP: 0.79,
};

function calculateChanges(prevRates: FxRates, nextRates: FxRates): Record<string, number> {
  const changes: Record<string, number> = {};
  for (const currency of Object.keys(nextRates)) {
    if (typeof prevRates[currency] === 'number') {
      const previous = prevRates[currency];
      const current = nextRates[currency];
      if (previous > 0) {
        changes[currency] = ((current - previous) / previous) * 100;
      }
    }
  }
  return changes;
}

export function useExchangeRate() {
  const [rates, setRates] = useState<FxRates>(DEFAULT_RATES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState<Record<string, number>>({});
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | undefined;
    let previousRates: FxRates | null = null;

    const saveCache = (ratesToCache: FxRates) => {
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ rates: ratesToCache, timestamp: Date.now() }),
        );
      } catch {
        // Ignore localStorage failures
      }
    };

    const loadCachedRates = (): FxRates | null => {
      if (typeof window === 'undefined') {
        return null;
      }
      try {
        const cached = window.localStorage.getItem(CACHE_KEY);
        if (!cached) return null;
        const parsed = JSON.parse(cached) as CacheData;
        if (Date.now() - parsed.timestamp < CACHE_EXPIRY) {
          return parsed.rates;
        }
      } catch {
        // Ignore invalid cache state
      }
      return null;
    };

    const fetchRates = async () => {
      try {
        const cachedRates = loadCachedRates();
        if (cachedRates) {
          previousRates = cachedRates;
          if (!cancelled) {
            setRates(cachedRates);
            setLoading(false);
          }
        }

        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        if (!response.ok) throw new Error('Failed to fetch exchange rates');
        const data = await response.json();
        const newRates = data.rates as FxRates;

        if (!cancelled) {
          setRates(newRates);
          setError(null);
          setLastUpdated(Date.now());

          if (previousRates) {
            setChanges(calculateChanges(previousRates, newRates));
          }

          saveCache(newRates);
          setLoading(false);
          previousRates = newRates;
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching FX rates:', err);
          setError('Using fallback rates');
          setLoading(false);
        }
      }
    };

    void fetchRates();
    intervalId = window.setInterval(() => {
      void fetchRates();
    }, POLL_INTERVAL);

    return () => {
      cancelled = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  const convert = (amount: number, toCurrency: string) => {
    const rate = rates[toCurrency] || 1;
    return amount * rate;
  };

  return { rates, loading, error, convert, changes, lastUpdated };
}
