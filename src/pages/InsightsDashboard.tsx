import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { TrendingUp, DollarSign, CheckCircle2, XCircle, BarChart3, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BottomNav } from '@/components/BottomNav';
import { fetchSpendingInsights } from '@/lib/activity';
import type { SpendingInsights } from '@/types/activity';

const CATEGORY_COLORS = [
  'hsl(var(--primary))',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
];

export default function InsightsDashboard() {
  const { data, isLoading, error } = useQuery<SpendingInsights>({
    queryKey: ['spending-insights'],
    queryFn: fetchSpendingInsights,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="px-6 pt-6 pb-4 border-b border-border/40">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Financial Insights</h1>
          </div>
          <p className="text-sm text-muted-foreground">Your spending patterns and trends</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 pt-6 space-y-6">
        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-5 text-sm text-destructive">
            Could not load insights. Please try again later.
          </div>
        ) : (
          <>
            <SummaryCards summary={data?.summary} isLoading={isLoading} />
            <MonthlyTrendsChart data={data?.monthlyTransferData} isLoading={isLoading} />
            <CategoryBreakdownChart data={data?.categoryData} isLoading={isLoading} />
            <TopExpensesList expenses={data?.topExpenses} isLoading={isLoading} />
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

function SummaryCards({
  summary,
  isLoading,
}: {
  summary?: SpendingInsights['summary'];
  isLoading: boolean;
}) {
  const tiles = summary
    ? [
        {
          icon: DollarSign,
          label: 'Total Sent',
          value: `$${summary.totalSent.toFixed(2)}`,
          helper: `$${summary.totalFees.toFixed(2)} in fees`,
        },
        {
          icon: TrendingUp,
          label: 'This Month',
          value: `$${summary.thisMonthSent.toFixed(2)}`,
          helper: `${summary.thisMonthCount} transfer${summary.thisMonthCount === 1 ? '' : 's'}`,
        },
        {
          icon: CheckCircle2,
          label: 'Completed',
          value: String(summary.completedTransfers),
          helper: `avg $${summary.averageTransfer.toFixed(2)}`,
        },
        {
          icon: XCircle,
          label: 'Failed',
          value: String(summary.failedTransfers),
          helper: `${summary.flaggedTransfers} flagged`,
        },
      ]
    : [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map(({ icon: Icon, label, value, helper }) => (
        <Card key={label} className="border-border/60">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4 text-primary" />
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
            </div>
            <p className="text-xl font-semibold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{helper}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MonthlyTrendsChart({
  data,
  isLoading,
}: {
  data?: SpendingInsights['monthlyTransferData'];
  isLoading: boolean;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="w-4 h-4 text-primary" />
          Monthly Trends
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : !data || data.length === 0 ? (
          <EmptyState message="No monthly data yet." />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
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
              <Bar dataKey="sent" name="Sent" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="successful" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryBreakdownChart({
  data,
  isLoading,
}: {
  data?: SpendingInsights['categoryData'];
  isLoading: boolean;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Tag className="w-4 h-4 text-primary" />
          Category Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : !data || data.length === 0 ? (
          <EmptyState message="No category data yet." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="category"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ category, percent }) =>
                  `${category} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {data.map((_, index) => (
                  <Cell
                    key={index}
                    fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                  />
                ))}
              </Pie>
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                    {value}
                  </span>
                )}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: 12,
                }}
                formatter={(value: number, name) => [`$${value.toFixed(2)}`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function TopExpensesList({
  expenses,
  isLoading,
}: {
  expenses?: SpendingInsights['topExpenses'];
  isLoading: boolean;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="w-4 h-4 text-primary" />
          Top Expenses
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : !expenses || expenses.length === 0 ? (
          <EmptyState message="No expense data yet." />
        ) : (
          <ul className="space-y-2">
            {expenses.map((expense) => (
              <li
                key={expense.id}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {expense.recipientName}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      {expense.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(expense.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <p className="text-sm font-semibold text-foreground ml-4">
                  ${expense.amount.toFixed(2)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground text-center">
      {message}
    </div>
  );
}
