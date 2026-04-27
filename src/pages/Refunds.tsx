import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useQuery } from '@tanstack/react-query';
import { fetchRefunds } from '@/lib/activity';
import { RefundTracker, RefundCard } from '@/components/RefundTracker';

const Refunds: React.FC = () => {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['refunds'],
    queryFn: fetchRefunds,
    refetchInterval: 30_000,
  });

  const refunds = data?.items ?? [];
  const completedRefunds = refunds.filter(
    (r) => r.status === 'completed' || r.status === 'failed',
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/40">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-base font-semibold">Refund Tracking</h1>
            <p className="text-xs text-muted-foreground">
              Track the status of your refunded transfers
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 space-y-6 max-w-lg mx-auto">
        {/* Active refunds tracker */}
        <RefundTracker refunds={refunds} isLoading={isLoading} />

        {/* Refund history */}
        {(completedRefunds.length > 0 || isLoading) && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-medium">Refund History</h2>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {completedRefunds.map((refund) => (
                    <RefundCard key={refund.id} refund={refund} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {!isLoading && refunds.length === 0 && (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <RotateCcw className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">No refunds yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Refunds appear here when a transfer is cancelled or fails.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Refunds;
