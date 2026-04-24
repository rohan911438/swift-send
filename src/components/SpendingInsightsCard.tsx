import { BarChart3, TrendingUp, ShieldAlert, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SpendingInsights } from '@/types/activity';

interface SpendingInsightsCardProps {
  insights?: SpendingInsights['summary'];
  isLoading?: boolean;
}

export function SpendingInsightsCard({ insights, isLoading = false }: SpendingInsightsCardProps) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="w-4 h-4 text-primary" />
            Spending Insights
          </CardTitle>
          {insights?.topCategory && <Badge variant="secondary">{insights.topCategory}</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : insights ? (
          <div className="grid grid-cols-2 gap-3">
            <InsightTile
              icon={TrendingUp}
              label="This Month"
              value={`$${insights.thisMonthSent.toFixed(2)}`}
              helper={`${insights.thisMonthCount} transfer${insights.thisMonthCount === 1 ? '' : 's'}`}
            />
            <InsightTile
              icon={Target}
              label="Average Send"
              value={`$${insights.averageTransfer.toFixed(2)}`}
              helper={`${insights.completedTransfers} completed`}
            />
            <InsightTile
              icon={ShieldAlert}
              label="Flagged"
              value={String(insights.flaggedTransfers)}
              helper={`${insights.failedTransfers} failed`}
            />
            <InsightTile
              icon={BarChart3}
              label="Fees Paid"
              value={`$${insights.totalFees.toFixed(2)}`}
              helper={`$${insights.totalSent.toFixed(2)} total sent`}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
            Insights will appear once transfer activity is available.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InsightTile({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-primary" />
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className="text-xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{helper}</p>
    </div>
  );
}
