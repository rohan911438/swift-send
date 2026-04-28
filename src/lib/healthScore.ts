import { FinancialHealthScore } from '@/types';
import { Transaction } from '@/types';

export function calculateHealthScore(transactions: Transaction[]): FinancialHealthScore {
  if (transactions.length === 0) {
    return {
      score: 50,
      grade: 'C',
      factors: {
        spendingConsistency: 50,
        transactionSuccess: 50,
        frequencyPattern: 50,
        riskLevel: 50,
      },
      recommendations: ['Start making transactions to build a financial profile'],
      lastCalculated: new Date(),
    };
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentTransactions = transactions.filter(
    (tx) => new Date(tx.timestamp) >= thirtyDaysAgo
  );

  const completedTxs = transactions.filter((tx) => tx.status === 'completed');
  const failedTxs = transactions.filter((tx) => tx.status === 'failed');
  const successRate = completedTxs.length / Math.max(transactions.length, 1);

  const amounts = completedTxs.map((tx) => tx.amount);
  const avgAmount = amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;
  const stdDev = calculateStdDev(amounts, avgAmount);
  const consistency = Math.min(100, 100 - (stdDev / avgAmount) * 10);

  const daysSinceLastTx = transactions.length > 0
    ? Math.floor((now.getTime() - new Date(transactions[0].timestamp).getTime()) / (1000 * 60 * 60 * 24))
    : 365;
  const frequencyScore = Math.max(0, 100 - daysSinceLastTx / 3.65);

  const riskFlags = transactions.filter((tx) => tx.risk && tx.risk.level !== 'low').length;
  const riskScore = Math.max(0, 100 - (riskFlags / Math.max(transactions.length, 1)) * 100);

  const successFactor = Math.min(100, successRate * 100);
  const averageScore = (consistency + successFactor + frequencyScore + riskScore) / 4;

  const recommendations: string[] = [];
  if (successRate < 0.9) {
    recommendations.push('Improve transaction success rate by verifying recipient details');
  }
  if (consistency < 50) {
    recommendations.push('Try to maintain more consistent transaction amounts');
  }
  if (frequencyScore < 30) {
    recommendations.push('Regular transactions help build a stronger financial profile');
  }
  if (riskScore < 50) {
    recommendations.push('Review and reduce flagged transactions for better security');
  }

  return {
    score: Math.round(averageScore),
    grade: getGradeFromScore(averageScore),
    factors: {
      spendingConsistency: Math.round(consistency),
      transactionSuccess: Math.round(successFactor),
      frequencyPattern: Math.round(frequencyScore),
      riskLevel: Math.round(riskScore),
    },
    recommendations:
      recommendations.length > 0
        ? recommendations
        : ['Great! Keep maintaining healthy transaction patterns'],
    lastCalculated: new Date(),
  };
}

function calculateStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

function getGradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
