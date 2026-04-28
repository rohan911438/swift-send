import { Globe2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNetwork, type StellarNetwork } from '@/contexts/NetworkContext';

interface NetworkSwitcherProps {
  className?: string;
  compact?: boolean;
}

const NETWORK_STYLES: Record<StellarNetwork, { badge: string; indicator: string }> = {
  testnet: {
    badge: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    indicator: 'bg-amber-400',
  },
  mainnet: {
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    indicator: 'bg-emerald-500',
  },
};

export function NetworkSwitcher({ className, compact = false }: NetworkSwitcherProps) {
  const { network, config, switchNetwork, isMainnet } = useNetwork();
  const styles = NETWORK_STYLES[network];

  function toggle() {
    switchNetwork(isMainnet ? 'testnet' : 'mainnet');
  }

  if (compact) {
    return (
      <button
        onClick={toggle}
        className={cn(
          'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
          styles.badge,
          className
        )}
        aria-label={`Current network: ${config.label}. Click to switch.`}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', styles.indicator)} />
        {config.label}
      </button>
    );
  }

  return (
    <div className={cn('rounded-xl border border-border/60 bg-card p-4', className)}>
      <div className="flex items-center gap-2 mb-3">
        <Globe2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Network</span>
        <span
          className={cn(
            'ml-auto rounded-full border px-2 py-0.5 text-xs font-medium',
            styles.badge
          )}
        >
          <span className={cn('mr-1 inline-block h-1.5 w-1.5 rounded-full', styles.indicator)} />
          {config.label}
        </span>
      </div>

      <div className="flex rounded-lg border border-border overflow-hidden text-sm">
        {(['testnet', 'mainnet'] as StellarNetwork[]).map((n) => (
          <button
            key={n}
            onClick={() => switchNetwork(n)}
            className={cn(
              'flex-1 py-1.5 font-medium transition-colors',
              n === network
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {n.charAt(0).toUpperCase() + n.slice(1)}
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs text-muted-foreground break-all">
        {config.horizonUrl}
      </p>

      {isMainnet && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
          ⚠ Mainnet — transactions use real funds.
        </p>
      )}
    </div>
  );
}
