import { useState, useEffect } from 'react';

const CACHE_KEY = 'swift_send_fx_rates';
const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour

interface FxRates {
  [key: string]: number;
}

interface CacheData {
  rates: FxRates;
  timestamp: number;
}

const DEFAULT_RATES: FxRates = {
  'USD': 1.0,
  'MXN': 17.25,
  'PHP': 56.50,
  'GTQ': 7.85,
  'EUR': 0.92,
  'GBP': 0.79,
};

export function useExchangeRate() {
  const [rates, setRates] = useState<FxRates>(DEFAULT_RATES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        // Check cache first
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { rates: cachedRates, timestamp }: CacheData = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_EXPIRY) {
            setRates(cachedRates);
            setLoading(false);
            return;
          }
        }

        // Fetch fresh rates
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        if (!response.ok) throw new Error('Failed to fetch exchange rates');
        
        const data = await response.json();
        const newRates = data.rates;
        
        // Update state and cache
        setRates(newRates);
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          rates: newRates,
          timestamp: Date.now()
        }));
        setLoading(false);
      } catch (err) {
        console.error('Error fetching FX rates:', err);
        setError('Using fallback rates');
        setLoading(false);
        // Keep using DEFAULT_RATES or cached rates if available
      }
    };

    fetchRates();
  }, []);

  const convert = (amount: number, toCurrency: string) => {
    const rate = rates[toCurrency] || 1;
    return amount * rate;
  };

  return { rates, loading, error, convert };
}
