import { Wallet, Eye, EyeOff, TrendingUp, DollarSign, Shield, Star, Lock, Clock } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface BalanceCardProps {
  usdcBalance: number;
  localCurrency: string;
  exchangeRate: number;
  lockedBalance?: number;
  pendingTransactions?: number;
  className?: string;
}

export function BalanceCard({ usdcBalance, localCurrency, exchangeRate, lockedBalance = 0, pendingTransactions = 0, className }: BalanceCardProps) {
  const [showBalance, setShowBalance] = useState(true);
  
  const fiatValue = usdcBalance * exchangeRate;
  const availableBalance = usdcBalance - lockedBalance;
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
          <div className="flex flex-col">
            <span className="text-sm font-medium opacity-90">USDC Balance</span>
            <div className="flex items-center gap-1 text-xs opacity-75">
              <Star className="w-3 h-3" />
              <span>Stellar Network</span>
            </div>
          </div>
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

        {/* Balance Breakdown */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 opacity-80">
              <TrendingUp className="w-4 h-4" />
              <span>Available</span>
            </div>
            <span className="font-medium">
              {showBalance ? `$${availableBalance.toFixed(2)}` : '••••'}
            </span>
          </div>
          
          {lockedBalance > 0 && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 opacity-80">
                <Lock className="w-4 h-4" />
                <span>Locked</span>
              </div>
              <span className="font-medium">
                {showBalance ? `$${lockedBalance.toFixed(2)}` : '••••'}
              </span>
            </div>
          )}

          {pendingTransactions > 0 && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 opacity-80">
                <Clock className="w-4 h-4" />
                <span>Pending Transactions</span>
              </div>
              <span className="font-medium">
                {pendingTransactions}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm opacity-90">
        <Shield className="w-4 h-4" />
        <span>Regulated stablecoin • 1:1 USD backed • FDIC protected</span>
      </div>
    </div>
  );
}
