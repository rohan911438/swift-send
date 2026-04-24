import { memo } from 'react';
import { ArrowUpRight, ArrowDownLeft, Phone, Receipt } from 'lucide-react';
import { Transaction } from '@/types';
import { StatusBadge } from './StatusBadge';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { splitFee } from '@/lib/fees';

interface TransactionItemProps {
  transaction: Transaction;
  onClick?: () => void;
  showDetailedView?: boolean;
}

function TransactionItemComponent({ transaction, onClick, showDetailedView = false }: TransactionItemProps) {
  const isSend = transaction.type === 'send';
  const feeSplit = splitFee(transaction.fee, { network: 0.1, service: 0.9 });

  return (
    <button
      onClick={onClick}
      className="w-full flex flex-col gap-3 p-3 sm:p-4 rounded-xl bg-card hover:bg-secondary/50 transition-all duration-200 shadow-card animate-slide-up border border-border/50 overflow-hidden"
    >
      {/* Main Transaction Row */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <div
          className={cn(
            'flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center',
            isSend ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
          )}
        >
          {isSend ? (
            <ArrowUpRight className="w-5 h-5 text-red-600" />
          ) : (
            <ArrowDownLeft className="w-5 h-5 text-green-600" />
          )}
        </div>

        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="font-semibold text-foreground truncate">
              {isSend ? 'To ' : 'From '}{transaction.recipientName}
            </p>
            <span
              className={cn(
                'font-bold text-base sm:text-lg',
                isSend ? 'text-foreground' : 'text-green-600'
              )}
            >
              {isSend ? '-' : '+'}${transaction.amount.toFixed(2)}
            </span>
          </div>
          
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="w-3 h-3" />
              <span className="truncate">{transaction.recipientPhone}</span>
            </div>
            <StatusBadge status={transaction.status} />
          </div>
        </div>
      </div>

      {transaction.risk && transaction.risk.level !== 'low' && (
        <div className="flex justify-start">
          <Badge
            variant="outline"
            className={cn(
              'text-[11px]',
              transaction.risk.level === 'high'
                ? 'border-red-300 text-red-700 bg-red-50 dark:bg-red-900/20'
                : 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-900/20',
            )}
          >
            {transaction.risk.level === 'high' ? 'Fraud Review' : 'Risk Flag'} • Score {transaction.risk.score}
          </Badge>
        </div>
      )}

      {/* Detailed Information */}
      {showDetailedView && (
        <div className="border-t border-border/50 pt-3 space-y-3">
          {/* Transaction Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-1">Transaction Time</p>
              <p className="font-medium text-foreground">
                {formatDistanceToNow(transaction.timestamp, { addSuffix: true })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">Transaction ID</p>
              <p className="font-mono text-xs text-foreground">
                {transaction.id.slice(0, 8)}...{transaction.id.slice(-4)}
              </p>
            </div>
          </div>

          {/* Fee Breakdown (for sent transactions) */}
          {isSend && (
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground mb-2">
                <Receipt className="w-3 h-3" />
                <span>Fee Breakdown</span>
              </div>
              
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount sent</span>
                  <span className="font-medium">${transaction.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network fee</span>
                  <span className="font-medium">${feeSplit.networkFee.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service fee</span>
                  <span className="font-medium">${feeSplit.serviceFee.toFixed(2)}</span>
                </div>
                <div className="border-t border-border/50 pt-1 mt-2">
                  <div className="flex justify-between font-semibold">
                    <span>Total cost</span>
                    <span>${(transaction.amount + transaction.fee).toFixed(2)}</span>
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded p-2 mt-2">
                  <div className="flex justify-between text-green-700 dark:text-green-300">
                    <span className="font-medium">Recipient received</span>
                    <span className="font-bold">${transaction.recipientAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {transaction.risk && transaction.risk.flags.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-800 dark:bg-amber-900/20">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                  Fraud Detection Flags
                </p>
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  Score {transaction.risk.score}/100
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {transaction.risk.flags.map((flag) => (
                  <Badge key={flag.code} variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-200">
                    {flag.label}
                  </Badge>
                ))}
              </div>
              {transaction.notes && (
                <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                  {transaction.notes}
                </p>
              )}
            </div>
          )}

          {/* Status Message */}
          <div className="text-center">
            {transaction.status === 'completed' && (
              <p className="text-xs text-green-600 dark:text-green-400">
                ✅ Settled on Stellar network • Transaction confirmed
              </p>
            )}
            {transaction.status === 'pending' && (
              <p className="text-xs text-orange-600 dark:text-orange-400">
                ⏳ Processing on Stellar network • 3-5 seconds remaining
              </p>
            )}
            {transaction.status === 'failed' && (
              <p className="text-xs text-red-600 dark:text-red-400">
                ❌ Transaction failed • USDC returned to your wallet
              </p>
            )}
          </div>
        </div>
      )}
    </button>
  );
}

export const TransactionItem = memo(TransactionItemComponent);
