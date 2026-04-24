import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';
import type { TransactionStatus } from '@/types';

interface StatusBadgeProps {
  status: TransactionStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = {
    pending: {
      icon: Clock,
      label: 'Pending',
      className: 'bg-pending/15 text-pending-foreground border-pending/30',
    },
    processing: {
      icon: Loader2,
      label: 'Processing',
      className: 'bg-primary/15 text-primary border-primary/30',
    },
    completed: {
      icon: CheckCircle2,
      label: 'Completed',
      className: 'bg-success/15 text-success border-success/30',
    },
    failed: {
      icon: XCircle,
      label: 'Failed',
      className: 'bg-destructive/15 text-destructive border-destructive/30',
    },
  };

  const { icon: Icon, label, className: statusClass } = config[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
        statusClass,
        className
      )}
    >
      <Icon
        className={cn(
          'w-3.5 h-3.5',
          status === 'processing' && 'animate-spin'
        )}
      />
      {label}
    </span>
  );
}
