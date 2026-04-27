import { format } from 'date-fns';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Transaction } from '@/types';
import { StatusBadge } from './StatusBadge';
import { cn } from '@/lib/utils';

interface ActivityTimelineProps {
  transactions: Transaction[];
}

const groupTransactionsByDay = (transactions: Transaction[]) => {
  const grouped: Record<string, Transaction[]> = {};
  transactions.forEach((transaction) => {
    const timestamp = transaction.timestamp instanceof Date ? transaction.timestamp : new Date(transaction.timestamp);
    const dateKey = format(timestamp, 'yyyy-MM-dd');
    grouped[dateKey] = grouped[dateKey] || [];
    grouped[dateKey].push(transaction);
  });
  return Object.entries(grouped)
    .sort(([a], [b]) => (a > b ? -1 : 1))
    .map(([date, items]) => ({ date, items: items.sort((a, b) => {
      const aDate = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
      const bDate = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
      return bDate.getTime() - aDate.getTime();
    }) }));
};

export function ActivityTimeline({ transactions }: ActivityTimelineProps) {
  const grouped = groupTransactionsByDay(transactions);

  return (
    <div className="space-y-6">
      {grouped.map((group) => (
        <div key={group.date} className="space-y-4">
          <div className="text-sm font-semibold text-foreground/90">{format(new Date(group.date), 'EEEE, MMMM d')}</div>
          <div className="space-y-4">
            {group.items.map((transaction) => {
              const timestamp = transaction.timestamp instanceof Date ? transaction.timestamp : new Date(transaction.timestamp);
              const isSend = transaction.type === 'send';
              return (
                <div key={transaction.id} className="relative pl-7">
                  <div className="absolute left-0 top-2 h-full w-px bg-border/60" />
                  <div className="absolute left-0 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-background shadow-sm">
                    {isSend ? (
                      <ArrowUpRight className="w-4 h-4 text-red-600" />
                    ) : (
                      <ArrowDownLeft className="w-4 h-4 text-green-600" />
                    )}
                  </div>

                  <div className="rounded-3xl border border-border/60 bg-card p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {isSend ? 'Sent to' : 'Received from'} {transaction.recipientName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {transaction.recipientPhone} • {format(timestamp, 'h:mm a')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          'rounded-full px-3 py-1 text-sm font-semibold',
                          isSend ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                        )}>
                          {isSend ? `-${transaction.amount.toFixed(2)}` : `+${transaction.amount.toFixed(2)}`}
                        </span>
                        <StatusBadge status={transaction.status} />
                      </div>
                    </div>

                    {transaction.category || transaction.notes ? (
                      <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                        {transaction.category && <p>Category: <span className="text-foreground">{transaction.category}</span></p>}
                        {transaction.notes && <p>Notes: <span className="text-foreground">{transaction.notes}</span></p>}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
