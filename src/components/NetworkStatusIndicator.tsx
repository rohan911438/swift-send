import { Activity, CloudOff, Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { NetworkStatusState } from '@/hooks/useNetworkStatus';

interface NetworkStatusIndicatorProps {
  network: NetworkStatusState;
  compact?: boolean;
}

function latencyLabel(latencyMs: number | null): string {
  if (latencyMs === null) {
    return 'Latency unavailable';
  }
  if (latencyMs >= 1200) {
    return `High latency ${latencyMs} ms`;
  }
  return `${latencyMs} ms`;
}

export function NetworkStatusIndicator({ network, compact = false }: NetworkStatusIndicatorProps) {
  const isOffline = network.status === 'offline';

  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3',
        isOffline ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200'
      )}
    >
      <div className={cn('flex items-center justify-between gap-3', compact && 'flex-wrap')}>
        <div className="flex items-center gap-2">
          {isOffline ? <CloudOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
          <span className="text-sm font-medium">
            Stellar network {isOffline ? 'offline' : 'online'}
          </span>
        </div>
        <Badge variant="secondary" className={cn(isOffline && 'bg-destructive/15 text-destructive')}>
          <Activity className="mr-1 h-3 w-3" />
          {latencyLabel(network.latencyMs)}
        </Badge>
      </div>
      {!compact && (
        <p className="mt-2 text-xs opacity-80">
          {isOffline ? 'Transfers are temporarily disabled until Horizon responds again.' : 'Live status is polled from the configured Horizon endpoint.'}
        </p>
      )}
    </div>
  );
}