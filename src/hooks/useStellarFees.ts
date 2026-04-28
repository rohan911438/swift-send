import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

interface NetworkFeeInfo {
  baseFee: number;
  baseFeeInXLM: number;
  lastUpdated: string;
  source: "cached" | "live";
}

interface FeeEstimate {
  networkFee: number;
  platformFee: number;
  totalFee: number;
  estimatedAt: string;
}

export function useStellarFees() {
  const [networkFee, setNetworkFee] = useState<NetworkFeeInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNetworkFee = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch("/fees/network");
      if (response.ok) {
        const data = await response.json();
        setNetworkFee(data);
      } else {
        setError("Failed to fetch network fee");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNetworkFee();
    // Refresh every minute
    const interval = setInterval(fetchNetworkFee, 60000);
    return () => clearInterval(interval);
  }, []);

  return {
    networkFee,
    loading,
    error,
    refresh: fetchNetworkFee,
  };
}

export function useEstimateFees(amount: number, currency: string = "XLM") {
  const [estimate, setEstimate] = useState<FeeEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!amount || amount <= 0) {
      setEstimate(null);
      return;
    }

    const fetchEstimate = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch(
          `/fees/estimate?amount=${amount}&currency=${currency}`,
        );
        if (response.ok) {
          const data = await response.json();
          setEstimate(data);
        } else {
          setError("Failed to estimate fees");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    // Debounce the API call
    const timeout = setTimeout(fetchEstimate, 500);
    return () => clearTimeout(timeout);
  }, [amount, currency]);

  return {
    estimate,
    loading,
    error,
  };
}

export function useNetworkCongestion() {
  const [congested, setCongested] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkCongestion = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/fees/congestion");
      if (response.ok) {
        const data = await response.json();
        setCongested(data.congested);
      }
    } catch (err) {
      console.error("Failed to check network congestion:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkCongestion();
    // Check every 2 minutes
    const interval = setInterval(checkCongestion, 120000);
    return () => clearInterval(interval);
  }, []);

  return {
    congested,
    loading,
    refresh: checkCongestion,
  };
}
