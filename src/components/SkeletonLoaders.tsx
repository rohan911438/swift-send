import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

/** Skeleton for a single balance/stat card */
export function SkeletonCard({ rows = 2 }: { rows?: number }) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <Skeleton className="h-4 w-28" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-8 w-36" />
        {Array.from({ length: rows - 1 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-24" />
        ))}
      </CardContent>
    </Card>
  );
}

/** Skeleton for a transaction list row */
export function SkeletonTransactionRow() {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/40 last:border-0">
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="space-y-1 text-right">
        <Skeleton className="h-3.5 w-16 ml-auto" />
        <Skeleton className="h-3 w-12 ml-auto" />
      </div>
    </div>
  );
}

/** Skeleton for a transaction list (n rows) */
export function SkeletonTransactionList({ rows = 5 }: { rows?: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTransactionRow key={i} />
      ))}
    </div>
  );
}

/** Skeleton for the dashboard header / balance area */
export function SkeletonBalanceHero() {
  return (
    <div className="space-y-3 px-2 py-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-3 w-32" />
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
    </div>
  );
}

/** Skeleton for a 2-column insights grid */
export function SkeletonInsightsGrid({ cells = 4 }: { cells?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: cells }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border/40 p-3 space-y-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for a bar chart placeholder */
export function SkeletonBarChart({ bars = 6 }: { bars?: number }) {
  return (
    <div className="flex items-end gap-2 h-32 px-2">
      {Array.from({ length: bars }).map((_, i) => {
        const heights = [40, 70, 55, 90, 45, 80, 60, 50];
        const pct = heights[i % heights.length];
        return (
          <Skeleton
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${pct}%` }}
          />
        );
      })}
    </div>
  );
}
