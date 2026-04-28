import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { SpendingInsights } from '@/types/activity';

interface ComparativeInsightsProps {
  data?: SpendingInsights['monthlyTransferData'];
  isLoading: boolean;
}

interface MonthComparison {
  label: string;
  current: number;
  previous: number;
  delta: number;
  pct: number;
}

function buildComparison(
  rows: SpendingInsights['monthlyTransferData'],
): MonthComparison[] {
  if (rows.length < 2) return [];

  return rows.slice(-6).reduce<MonthComparison[]>((acc, row, i, arr) => {
    if (i === 0) return acc;
    const prev = arr[i - 1];
    const delta = row.sent - prev.sent;
    const pct = prev.sent === 0 ? 0 : (delta / prev.sent) * 100;
    acc.push({
      label: row.month,
      current: row.sent,
      previous: prev.sent,
      delta,
      pct,
    });
    return acc;
  }, []);
}

function DeltaBadge({ pct }: { pct: number }) {
  const rounded = Math.abs(pct).toFixed(1);
  if (pct > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-rose-600 dark:text-rose-400">
        <TrendingUp className="h-3 w-3" />
        +{rounded}%
      </span>
    );
  }
  if (pct < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <TrendingDown className="h-3 w-3" />
        -{rounded}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
      <Minus className="h-3 w-3" />
      0%
    </span>
  );
}

export function ComparativeInsights({ data, isLoading }: ComparativeInsightsProps) {
  const comparisons = useMemo(() => (data ? buildComparison(data) : []), [data]);
  const chartData = useMemo(
    () => comparisons.map(({ label, current, previous }) => ({ label, current, previous })),
    [comparisons],
  );

  const latestDelta = comparisons.at(-1);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="w-4 h-4 text-primary" />
          Month-over-Month Comparison
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-xl border border-border/40 p-3 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
            <Skeleton className="h-40 w-full rounded-xl" />
          </>
        ) : comparisons.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground text-center">
            Need at least 2 months of data to compare.
          </div>
        ) : (
          <>
            {latestDelta && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    {latestDelta.label} (this month)
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    ${latestDelta.current.toFixed(2)}
                  </p>
                  <DeltaBadge pct={latestDelta.pct} />
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Previous month</p>
                  <p className="text-lg font-semibold text-foreground">
                    ${latestDelta.previous.toFixed(2)}
                  </p>
                  <span className="text-xs text-muted-foreground">baseline</span>
                </div>
              </div>
            )}

            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                      {value}
                    </span>
                  )}
                />
                <Bar
                  dataKey="current"
                  name="This Month"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="previous"
                  name="Prev Month"
                  fill="#94a3b8"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>

            <ul className="space-y-1.5">
              {comparisons.map(({ label, current, previous, delta, pct }) => (
                <li
                  key={label}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-foreground">${current.toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground">
                    vs ${previous.toFixed(2)}
                  </span>
                  <DeltaBadge pct={pct} />
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
