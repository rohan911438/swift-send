import { useEffect, useCallback, useRef } from 'react';

export type BalanceUpdateCallback = (newBalance: number) => void;

export interface BalanceSyncConfig {
  intervalMs: number;
  enabled: boolean;
}

export const DEFAULT_BALANCE_SYNC_INTERVAL_MS = 10000; // 10 seconds
export const MIN_BALANCE_SYNC_INTERVAL_MS = 5000; // 5 seconds
export const MAX_BALANCE_SYNC_INTERVAL_MS = 60000; // 60 seconds

interface StellarBalanceEntry {
  asset: string;
  balance: string;
}

export async function fetchBalanceFromNetwork(walletAddress: string): Promise<number> {
  const HORIZON_URL = (import.meta.env.VITE_STELLAR_HORIZON_URL as string | undefined) || 'https://horizon-testnet.stellar.org';
  
  try {
    const response = await fetch(`${HORIZON_URL}/accounts/${walletAddress}`);
    if (!response.ok) {
      throw new Error('Failed to fetch account');
    }
    
    const data = await response.json() as { balances: StellarBalanceEntry[] };
    const balanceEntry = data.balances.find((b) => b.asset === 'USDC' || b.asset === 'native');
    
    if (!balanceEntry) {
      return 0;
    }
    
    return parseFloat(balanceEntry.balance);
  } catch (error) {
    console.error('Failed to fetch balance from network:', error);
    throw error;
  }
}

export function useBalanceSync(
  walletAddress: string | undefined,
  onBalanceUpdate: BalanceUpdateCallback,
  config?: Partial<BalanceSyncConfig>
) {
  const intervalMs = config?.intervalMs ?? DEFAULT_BALANCE_SYNC_INTERVAL_MS;
  const enabled = config?.enabled ?? true;
  const intervalRef = useRef<number | null>(null);
  const lastBalanceRef = useRef<number>(0);

  const syncBalance = useCallback(async () => {
    if (!walletAddress || !enabled) return;

    try {
      const balance = await fetchBalanceFromNetwork(walletAddress);
      if (balance !== lastBalanceRef.current) {
        lastBalanceRef.current = balance;
        onBalanceUpdate(balance);
      }
    } catch (error) {
      console.error('Balance sync failed:', error);
    }
  }, [walletAddress, onBalanceUpdate, enabled]);

  useEffect(() => {
    if (!walletAddress || !enabled) return;

    syncBalance();

    intervalRef.current = window.setInterval(syncBalance, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [walletAddress, intervalMs, enabled, syncBalance]);

  return {
    syncNow: syncBalance,
  };
}