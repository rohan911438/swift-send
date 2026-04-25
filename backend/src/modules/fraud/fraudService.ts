import { logger } from '../../logger';
import type { TransferRecord } from '../transfers/domain';
import { EventBus } from '../../core/eventBus';

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

export interface SuspiciousActivityAlert {
  id: string;
  userId: string;
  alertType: 'large_transfer' | 'unusual_location' | 'rapid_succession' | 'pattern_anomaly' | 'high_risk_destination';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  acknowledged: boolean;
}

interface AssessTransferInput {
  userId: string;
  transferId: string;
  amount: number;
  destinationCountry?: string;
  recipientType: string;
  historicalTransfers: TransferRecord[];
  userLocation?: string;
}

export class FraudService {
  private readonly auditLog: FraudAuditEntry[] = [];
  private readonly suspiciousAlerts: SuspiciousActivityAlert[] = [];
  private readonly highRiskDestinations = new Set(['AF', 'BY', 'IR', 'KP', 'RU', 'SY']);
  private readonly eventBus?: EventBus;

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus;
  }

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

    // Flag large transfers
    if (input.amount >= 1000) {
      score += 20;
      flags.push({ code: 'large_amount', label: 'Large transfer amount', severity: 'medium' });
    }

    if (input.amount >= 2500) {
      score += 15;
      flags.push({ code: 'very_large_amount', label: 'Very large transfer amount', severity: 'high' });
    }

    // Detect rapid succession transfers
    if (dailyTransferCount >= 4) {
      score += 18;
      flags.push({ code: 'rapid_repeat', label: 'Multiple transfers in 24 hours', severity: 'medium' });
    }

    // High velocity detection
    if (dailyTransferVolume >= 3000) {
      score += 20;
      flags.push({ code: 'high_velocity', label: 'High daily transfer velocity', severity: 'high' });
    }

    // Pattern anomaly detection
    if (repeatedAmounts >= 2) {
      score += 14;
      flags.push({ code: 'structured_amounts', label: 'Repeated transfer amount pattern', severity: 'medium' });
    }

    if (recentFailures >= 2) {
      score += 12;
      flags.push({ code: 'repeat_failures', label: 'Multiple failed transfer attempts', severity: 'medium' });
    }

    // High-risk destination detection
    if (input.destinationCountry && this.highRiskDestinations.has(input.destinationCountry.toUpperCase())) {
      score += 28;
      flags.push({ code: 'high_risk_destination', label: 'High-risk destination corridor', severity: 'high' });
    }

    // Unusual location detection
    if (input.userLocation) {
      const userLocations = this.getUserLocations(input.historicalTransfers);
      if (userLocations.length > 0 && !userLocations.includes(input.userLocation)) {
        score += 25;
        flags.push({ code: 'unusual_location', label: 'Transfer from unusual location', severity: 'high' });
      }
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

    // Create suspicious activity alerts
    this.createSuspiciousAlerts(input.userId, input.transferId, input.assessment, createdAt);

    logger.warn(
      {
        transferId: input.transferId,
        userId: input.userId,
        score: input.assessment.score,
        flags: input.assessment.flags.map((flag) => flag.code),
      },
      'abnormal transfer activity detected',
    );
  }

  private createSuspiciousAlerts(
    userId: string,
    transferId: string,
    assessment: FraudAssessment,
    createdAt: string,
  ) {
    for (const flag of assessment.flags) {
      let alertType: SuspiciousActivityAlert['alertType'];
      let title: string;
      let description: string;
      let severity: SuspiciousActivityAlert['severity'];

      switch (flag.code) {
        case 'large_amount':
        case 'very_large_amount':
          alertType = 'large_transfer';
          title = 'Large Transfer Detected';
          description = `A transfer of unusual size was detected. Risk score: ${assessment.score}/100`;
          severity = flag.severity === 'high' ? 'high' : 'medium';
          break;
        case 'unusual_location':
          alertType = 'unusual_location';
          title = 'Unusual Location Activity';
          description = 'Transfer initiated from an unrecognized location';
          severity = 'high';
          break;
        case 'rapid_repeat':
        case 'high_velocity':
          alertType = 'rapid_succession';
          title = 'Rapid Transfer Activity';
          description = 'Multiple transfers detected in a short time period';
          severity = flag.severity === 'high' ? 'high' : 'medium';
          break;
        case 'structured_amounts':
          alertType = 'pattern_anomaly';
          title = 'Unusual Pattern Detected';
          description = 'Repetitive transfer patterns detected that may indicate structuring';
          severity = 'medium';
          break;
        case 'high_risk_destination':
          alertType = 'high_risk_destination';
          title = 'High-Risk Destination';
          description = 'Transfer to a high-risk jurisdiction detected';
          severity = 'high';
          break;
        default:
          continue;
      }

      const alert: SuspiciousActivityAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId,
        alertType,
        severity,
        title,
        description,
        metadata: {
          transferId,
          flagCode: flag.code,
          riskScore: assessment.score,
        },
        createdAt,
        acknowledged: false,
      };

      this.suspiciousAlerts.unshift(alert);

      // Publish event for notifications
      if (this.eventBus) {
        void this.eventBus.publish({
          type: 'suspicious.activity.detected',
          timestamp: createdAt,
          payload: {
            userId,
            alertId: alert.id,
            alertType,
            severity,
            transferId,
          },
        });
      }
    }
  }

  private getUserLocations(transfers: TransferRecord[]): string[] {
    const locations = new Set<string>();
    for (const transfer of transfers) {
      const location = transfer.recipient.metadata?.location as string | undefined;
      if (location) {
        locations.add(location);
      }
    }
    return Array.from(locations);
  }

  getSuspiciousAlerts(userId?: string, limit = 50): SuspiciousActivityAlert[] {
    return this.suspiciousAlerts
      .filter((alert) => !userId || alert.userId === userId)
      .slice(0, Math.max(0, limit));
  }

  acknowledgeAlert(alertId: string): SuspiciousActivityAlert | null {
    const alert = this.suspiciousAlerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
    return alert || null;
  }

  listAuditEntries(userId?: string, limit = 50) {
    return this.auditLog
      .filter((entry) => !userId || entry.userId === userId)
      .slice(0, Math.max(0, limit));
  }
}
