import { Info, Zap, Shield, ArrowRight, HelpCircle, Star, Globe2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateFees, calculateSavings } from '@/lib/feeCalculation';

interface FeeBreakdownProps {
  amount: number;
  networkFee: number;
  serviceFee: number;
  totalFee: number;
  recipientGets: number;
  className?: string;
}

export function FeeBreakdown({
  amount,
  className,
}: {
  amount: number;
  className?: string;
}) {
  const fees = calculateFees(amount);
  const savings = calculateSavings(amount);
  
  return (
    <div
      className={cn(
        'bg-card rounded-xl p-5 shadow-card space-y-4 animate-scale-in border border-border/50',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Info className="w-4 h-4 text-blue-600" />
          Fee Transparency
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="w-3 h-3 text-blue-500" />
          <span>Stellar Network</span>
        </div>
      </div>

      <div className="space-y-3">
        {/* Your amount */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Your amount</span>
          <span className="font-semibold text-foreground">${amount.toFixed(2)}</span>
        </div>

        {/* Fees */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Star className="w-4 h-4 text-blue-500" />
              <span>Stellar network fee</span>
            </div>
            <span className="font-medium text-foreground">${fees.networkFee.toFixed(4)}</span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="w-4 h-4 text-green-500" />
              <span>Service fee (0.5%)</span>
            </div>
            <span className="font-medium text-foreground">${fees.serviceFee.toFixed(2)}</span>
          </div>
        </div>

        <div className="border-t border-border/50 pt-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Total fees</span>
            <span className="font-semibold text-foreground">${fees.totalFee.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Recipient gets - highlighted */}
      <div className="bg-gradient-to-r from-green-50 to-green-50/50 dark:from-green-900/20 dark:to-green-900/10 rounded-lg p-4 border border-green-200/50 dark:border-green-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-green-600" />
            <span className="font-semibold text-foreground">Recipient receives</span>
          </div>
          <span className="text-2xl font-bold text-green-600">
            ${fees.recipientGets.toFixed(2)} USDC
          </span>
        </div>
        <p className="text-xs text-green-600 dark:text-green-400 mt-1 ml-7">
          Settles in 3-5 seconds • 1:1 USD backed • Final amount guaranteed
        </p>
      </div>

      {/* Professional comparison */}
      <div className="bg-slate-50 dark:bg-slate-900/30 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <Globe2 className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
            Institutional-Grade Infrastructure
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">Traditional Wire</p>
            <p className="text-slate-700 dark:text-slate-300">
              $15-45 fee • 1-3 business days
            </p>
          </div>
          <div>
            <p className="text-blue-600 dark:text-blue-400 font-medium">Stellar Network</p>
            <p className="text-blue-700 dark:text-blue-300">
              ${fees.totalFee.toFixed(2)} fee • 3-5 seconds
            </p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
          Powered by Stellar's global payment network with 99.99% uptime and bank-grade security
        </div>
      </div>
    </div>
  );
}
