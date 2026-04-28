import { createLogger } from '../../logger';
import type { TransferRecord } from '../transfers/domain';

export type FraudSeverity = 'low' | 'medium' | 'high';
export type FraudRiskLevel = 'low' | 'medium' | 'high';

export interface FraudFlag {
  code: string;
  label: string;
  severity: FraudSeverity;
}

export interface FraudAssessment {
  score: number;
  level: FraudRiskLevel;
  flags: FraudFlag[];
  requiresReview: boolean;
  loggedAt?: string;
}

export interface FraudAuditEntry {
  id: string;
  userId: string;
  transferId: string;
  score: number;
  level: FraudRiskLevel;
  flags: FraudFlag[];
  message: string;
  createdAt: string;
}

interface AssessTransferInput {
  userId: string;
  transferId: string;
  amount: number;
  destinationCountry?: string;
  recipientType: string;
  historicalTransfers: TransferRecord[];
}

export class FraudService {
  private readonly auditLog: FraudAuditEntry[] = [];
  private readonly highRiskDestinations = new Set(['AF', 'BY', 'IR', 'KP', 'RU', 'SY']);

  assessTransfer(input: AssessTransferInput): FraudAssessment {
    let score = 8;
    const flags: FraudFlag[] = [];
    const now = Date.now();
    const last24Hours = input.historicalTransfers.filter(
      (record) => now - new Date(record.createdAt).getTime() <= 24 * 60 * 60 * 1000,
    );
    const dailyTransferCount = last24Hours.length + 1;
    const dailyTransferVolume = last24Hours
      .filter((record) => record.state !== 'failed')
      .reduce((sum, record) => sum + record.amount, input.amount);
    const repeatedAmounts = last24Hours.filter(
      (record) => Math.abs(record.amount - input.amount) < 0.01,
    ).length;
    const recentFailures = last24Hours.filter((record) => record.state === 'failed').length;

    if (input.amount >= 1000) {
      score += 20;
      flags.push({ code: 'large_amount', label: 'Large transfer amount', severity: 'medium' });
    }

    if (input.amount >= 2500) {
      score += 15;
      flags.push({ code: 'very_large_amount', label: 'Very large transfer amount', severity: 'high' });
    }

    if (dailyTransferCount >= 4) {
      score += 18;
      flags.push({ code: 'rapid_repeat', label: 'Multiple transfers in 24 hours', severity: 'medium' });
    }

    if (dailyTransferVolume >= 3000) {
      score += 20;
      flags.push({ code: 'high_velocity', label: 'High daily transfer velocity', severity: 'high' });
    }

    if (repeatedAmounts >= 2) {
      score += 14;
      flags.push({ code: 'structured_amounts', label: 'Repeated transfer amount pattern', severity: 'medium' });
    }

    if (recentFailures >= 2) {
      score += 12;
      flags.push({ code: 'repeat_failures', label: 'Multiple failed transfer attempts', severity: 'medium' });
    }

    if (input.destinationCountry && this.highRiskDestinations.has(input.destinationCountry.toUpperCase())) {
      score += 28;
      flags.push({ code: 'high_risk_destination', label: 'High-risk destination corridor', severity: 'high' });
    }

    if (input.recipientType === 'cash_pickup') {
      score += 6;
    }

    const boundedScore = Math.min(score, 100);
    const level: FraudRiskLevel =
      boundedScore >= 70 ? 'high' : boundedScore >= 35 ? 'medium' : 'low';

    return {
      score: boundedScore,
      level,
      flags,
      requiresReview: level === 'high' || flags.some((flag) => flag.severity === 'high'),
    };
  }

  logAbnormalActivity(input: {
    userId: string;
    transferId: string;
    assessment: FraudAssessment;
    recipientName: string;
  }) {
    const logger = this.getLogger({ transferId: input.transferId, userId: input.userId });
    if (input.assessment.level === 'low' && input.assessment.flags.length === 0) {
      return;
    }

    const createdAt = new Date().toISOString();
    const entry: FraudAuditEntry = {
      id: `fraud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId: input.userId,
      transferId: input.transferId,
      score: input.assessment.score,
      level: input.assessment.level,
      flags: input.assessment.flags,
      message: `Transfer for ${input.recipientName} flagged with ${input.assessment.level} risk`,
      createdAt,
    };

    this.auditLog.unshift(entry);
    input.assessment.loggedAt = createdAt;

    logger.warn(
      {
        score: input.assessment.score,
        flags: input.assessment.flags.map((flag) => flag.code),
      },
      'abnormal transfer activity detected',
    );
  }

  listAuditEntries(userId?: string, limit = 50) {
    return this.auditLog
      .filter((entry) => !userId || entry.userId === userId)
      .slice(0, Math.max(0, limit));
  }

  private getLogger(context: Record<string, unknown>) {
    return createLogger({ component: 'fraudService', ...context });
  }
}
