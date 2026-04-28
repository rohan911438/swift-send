import { Activity, Zap, Target, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FinancialHealthScore } from '@/types/activity';
import { cn } from '@/lib/utils';

interface HealthScoreCardProps {
  healthScore?: FinancialHealthScore;
  isLoading?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 70) return 'text-yellow-600 dark:text-yellow-400';
  if (score >= 60) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function getGradeBg(grade: string): string {
  switch (grade) {
    case 'A':
      return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800';
    case 'B':
      return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    case 'C':
      return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
    case 'D':
      return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
    default:
      return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  }
}

export function HealthScoreCard({ healthScore, isLoading = false }: HealthScoreCardProps) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-4 h-4 text-primary" />
            Financial Health Score
          </CardTitle>
          {healthScore && (
            <Badge variant="outline" className={cn('text-sm font-bold', getScoreColor(healthScore.score))}>
              {healthScore.score}/100
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-12 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : healthScore ? (
          <>
            {/* Score Display */}
            <div className={cn('rounded-xl border-2 p-4 text-center', getGradeBg(healthScore.grade))}>
              <div className={cn('text-4xl font-bold mb-1', getScoreColor(healthScore.score))}>
                {healthScore.grade}
              </div>
              <p className="text-xs text-muted-foreground">Financial Health Grade</p>
              <p className="text-sm font-medium mt-2 text-foreground">{healthScore.score} points</p>
            </div>

            {/* Factors Grid */}
            <div className="grid grid-cols-2 gap-2">
              <FactorTile
                icon={Target}
                label="Spending Consistency"
                value={healthScore.factors.spendingConsistency}
              />
              <FactorTile
                icon={CheckCircle}
                label="Success Rate"
                value={healthScore.factors.transactionSuccess}
              />
              <FactorTile
                icon={Zap}
                label="Frequency Pattern"
                value={healthScore.factors.frequencyPattern}
              />
              <FactorTile
                icon={AlertCircle}
                label="Risk Level"
                value={healthScore.factors.riskLevel}
              />
            </div>

            {/* Recommendations */}
            {healthScore.recommendations.length > 0 && (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">Recommendations</p>
                <ul className="space-y-1">
                  {healthScore.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-xs text-muted-foreground flex gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
            Health score will appear once you have transaction activity.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FactorTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target;
  label: string;
  value: number;
}) {
  const isGood = value >= 75;
  const isOk = value >= 50;

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3 h-3 text-primary" />
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5 mb-1">
        <div
          className={cn('h-full rounded-full transition-all', {
            'bg-emerald-500': isGood,
            'bg-yellow-500': isOk && !isGood,
            'bg-red-500': !isOk,
          })}
          style={{ width: `${value}%` }}
        />
      </div>
      <p className="text-xs font-semibold text-foreground">{value}/100</p>
    </div>
  );
}
