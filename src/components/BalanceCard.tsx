import { Wallet, Eye, EyeOff, TrendingUp, DollarSign } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface BalanceCardProps {
  usdcBalance: number;
  localCurrency: string;
  exchangeRate: number;
  className?: string;
}

export function BalanceCard({ usdcBalance, localCurrency, exchangeRate, className }: BalanceCardProps) {
  const [showBalance, setShowBalance] = useState(true);
  
  const fiatValue = usdcBalance * exchangeRate;
  const currencySymbol = localCurrency === 'USD' ? '$' : localCurrency === 'EUR' ? '€' : localCurrency;

  return (
    <div
      className={cn(
        'gradient-hero rounded-2xl p-6 text-primary-foreground shadow-soft animate-fade-in',
        className
      )}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary-foreground/20">
            <Wallet className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium opacity-90">Available Balance</span>
        </div>
        <button
          onClick={() => setShowBalance(!showBalance)}
          className="p-2 rounded-lg hover:bg-primary-foreground/10 transition-colors"
          aria-label={showBalance ? 'Hide balance' : 'Show balance'}
        >
          {showBalance ? (
            <Eye className="w-5 h-5 opacity-80" />
          ) : (
            <EyeOff className="w-5 h-5 opacity-80" />
          )}
        </button>
      </div>

      <div className="mb-6">
        {/* Primary Balance - USDC */}
        <div className="flex items-baseline gap-3 mb-2">
          <span className="text-5xl font-bold tracking-tight">
            {showBalance ? usdcBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '••••••'}
          </span>
          <span className="text-xl font-semibold opacity-90 bg-primary-foreground/20 px-3 py-1 rounded-lg">
            USDC
          </span>
        </div>
        
        {/* Fiat Equivalent */}
        {localCurrency !== 'USDC' && (
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 opacity-70" />
            <span className="text-lg opacity-80">
              ≈ {showBalance ? `${currencySymbol}${fiatValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '••••••'} {localCurrency}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm opacity-90">
        <TrendingUp className="w-4 h-4" />
        <span>Secured in your personal wallet • Instant global transfers</span>
      </div>
    </div>
  );
}
