import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import type { RefundRecord, RefundStatus } from '@/types/activity';

interface RefundStatusBadgeProps {
  status: RefundStatus;
}

function RefundStatusBadge({ status }: RefundStatusBadgeProps) {
  const config: Record<RefundStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    pending:    { label: 'Pending',    variant: 'secondary',    icon: <Clock className="w-3 h-3" /> },
    processing: { label: 'Processing', variant: 'default',      icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
    completed:  { label: 'Completed',  variant: 'outline',      icon: <CheckCircle2 className="w-3 h-3 text-green-500" /> },
    failed:     { label: 'Failed',     variant: 'destructive',  icon: <XCircle className="w-3 h-3" /> },
  };

  const { label, variant, icon } = config[status];

  return (
    <Badge variant={variant} className="flex items-center gap-1 w-fit">
      {icon}
      {label}
    </Badge>
  );
}

interface RefundCardProps {
  refund: RefundRecord;
}

export function RefundCard({ refund }: RefundCardProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">
            {refund.recipientName ?? 'Unknown recipient'}
          </p>
          <p className="text-xs text-muted-foreground">
            Transfer ID: {refund.transferId.slice(0, 8)}…
          </p>
        </div>
        <RefundStatusBadge status={refund.status} />
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Refund amount</span>
        <span className="font-semibold">
          {refund.amount.toFixed(2)} {refund.currency}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Initiated {refund.initiatedAt.toLocaleDateString()}</span>
        {refund.completedAt && (
          <span>Completed {refund.completedAt.toLocaleDateString()}</span>
        )}
      </div>

      {refund.reason && (
        <p className="text-xs text-muted-foreground border-t pt-2">
          Reason: {refund.reason}
        </p>
      )}
    </div>
  );
}

interface RefundTrackerProps {
  refunds: RefundRecord[];
  isLoading?: boolean;
}

export function RefundTracker({ refunds, isLoading = false }: RefundTrackerProps) {
  const activeRefunds = refunds.filter((r) => r.status === 'pending' || r.status === 'processing');

  if (isLoading) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="w-4 h-4 text-primary" />
            Active Refunds
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="w-4 h-4 text-primary" />
            Active Refunds
          </CardTitle>
          {activeRefunds.length > 0 && (
            <Badge variant="secondary">{activeRefunds.length}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {activeRefunds.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No active refunds. All transfers are settled.
          </p>
        ) : (
          <div className="space-y-3">
            {activeRefunds.map((refund) => (
              <RefundCard key={refund.id} refund={refund} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
