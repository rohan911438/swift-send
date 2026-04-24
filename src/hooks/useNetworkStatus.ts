import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export interface NetworkStatusState {
  status: 'online' | 'offline';
  latencyMs: number | null;
  checkedAt: string | null;
  isLoading: boolean;
}

const DEFAULT_STATE: NetworkStatusState = {
  status: 'online',
  latencyMs: null,
  checkedAt: null,
  isLoading: true,
};

export function useNetworkStatus(pollIntervalMs = 15000): NetworkStatusState {
  const [state, setState] = useState<NetworkStatusState>(DEFAULT_STATE);

  useEffect(() => {
    let cancelled = false;

    const loadStatus = async () => {
      try {
        const response = await apiFetch('/health/ready');
        const body = (await response.json().catch(() => ({}))) as {
          stellar?: { status?: 'online' | 'offline'; latencyMs?: number | null; checkedAt?: string };
        };

        if (cancelled) {
          return;
        }

        setState({
          status: body.stellar?.status || 'offline',
          latencyMs: typeof body.stellar?.latencyMs === 'number' ? body.stellar.latencyMs : null,
          checkedAt: body.stellar?.checkedAt || null,
          isLoading: false,
        });
      } catch {
        if (cancelled) {
          return;
        }

        setState({
          status: 'offline',
          latencyMs: null,
          checkedAt: new Date().toISOString(),
          isLoading: false,
        });
      }
    };

    void loadStatus();
    const intervalId = window.setInterval(() => {
      void loadStatus();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [pollIntervalMs]);

  return state;
}