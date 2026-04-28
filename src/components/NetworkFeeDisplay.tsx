import { AlertCircle, TrendingUp, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEstimateFees, useNetworkCongestion } from "@/hooks/useStellarFees";
import { formatDistanceToNow } from "date-fns";

interface NetworkFeeDisplayProps {
  amount: number;
  currency?: string;
  showDetails?: boolean;
}

export function NetworkFeeDisplay({
  amount,
  currency = "XLM",
  showDetails = true,
}: NetworkFeeDisplayProps) {
  const { estimate, loading, error } = useEstimateFees(amount, currency);
  const { congested } = useNetworkCongestion();

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Fee Estimation Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!estimate) {
    return null;
  }

  return (
    <div className="space-y-3">
      {congested && (
        <Alert variant="destructive">
          <TrendingUp className="h-4 w-4" />
          <AlertTitle>Network Congestion</AlertTitle>
          <AlertDescription>
            The Stellar network is experiencing high traffic. Fees may be
            elevated.
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Fee Estimate</span>
          <Badge variant="outline" className="text-xs">
            Updated{" "}
            {formatDistanceToNow(new Date(estimate.estimatedAt), {
              addSuffix: true,
            })}
          </Badge>
        </div>

        {showDetails && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Network Fee</span>
              <span className="font-mono">
                {estimate.networkFee.toFixed(7)} XLM
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform Fee</span>
              <span className="font-mono">
                {estimate.platformFee.toFixed(7)} XLM
              </span>
            </div>
            <div className="border-t pt-2 flex justify-between font-medium">
              <span>Total Fee</span>
              <span className="font-mono">
                {estimate.totalFee.toFixed(7)} XLM
              </span>
            </div>
          </div>
        )}

        {!showDetails && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total Fee</span>
            <span className="text-lg font-mono font-semibold">
              {estimate.totalFee.toFixed(7)} XLM
            </span>
          </div>
        )}

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Fees are estimated in real-time based on current network conditions.
            The actual fee may vary slightly at the time of transaction.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
