import { logger } from "../../logger";
import type { EventBus } from "../../core/eventBus";

export type ComplianceCheckType =
  | "aml"
  | "kyc"
  | "sanctions"
  | "transaction_limit"
  | "risk_assessment";
export type ComplianceCheckStatus =
  | "passed"
  | "flagged"
  | "blocked"
  | "manual_review";

export interface ComplianceLog {
  id: string;
  userId: string;
  transferId?: string;
  checkType: ComplianceCheckType;
  status: ComplianceCheckStatus;
  riskScore: number;
  flags: string[];
  metadata: Record<string, unknown>;
  checkedAt: string;
  checkedBy: string; // 'system' or admin userId
  notes?: string;
}

export interface AMLCheckResult {
  passed: boolean;
  riskScore: number;
  flags: string[];
  requiresManualReview: boolean;
}

export class ComplianceLogService {
  private logs: ComplianceLog[] = [];

  constructor(private readonly eventBus: EventBus) {}

  /**
   * Perform AML check and log the result
   */
  async performAMLCheck(input: {
    userId: string;
    transferId?: string;
    amount: number;
    destinationCountry?: string;
    recipientId?: string;
  }): Promise<AMLCheckResult> {
    const flags: string[] = [];
    let riskScore = 0;

    // Check for high-risk countries
    const highRiskCountries = ["RU", "BY", "IR", "KP", "SY"];
    if (
      input.destinationCountry &&
      highRiskCountries.includes(input.destinationCountry.toUpperCase())
    ) {
      flags.push("high_risk_country");
      riskScore += 30;
    }

    // Check for large amounts
    if (input.amount > 5000) {
      flags.push("large_amount");
      riskScore += 20;
    }

    if (input.amount > 10000) {
      flags.push("very_large_amount");
      riskScore += 30;
    }

    // Check for rapid transactions (simplified - in production would check actual history)
    const recentLogs = this.logs.filter(
      (log) =>
        log.userId === input.userId &&
        log.checkType === "aml" &&
        new Date(log.checkedAt).getTime() > Date.now() - 3600000, // Last hour
    );

    if (recentLogs.length > 5) {
      flags.push("rapid_transactions");
      riskScore += 25;
    }

    // Determine status
    let status: ComplianceCheckStatus = "passed";
    let requiresManualReview = false;

    if (riskScore >= 70) {
      status = "blocked";
      requiresManualReview = true;
    } else if (riskScore >= 40) {
      status = "flagged";
      requiresManualReview = true;
    } else if (riskScore >= 20) {
      status = "flagged";
    }

    // Log the check
    const log = this.createLog({
      userId: input.userId,
      transferId: input.transferId,
      checkType: "aml",
      status,
      riskScore,
      flags,
      metadata: {
        amount: input.amount,
        destinationCountry: input.destinationCountry,
        recipientId: input.recipientId,
      },
      checkedBy: "system",
    });

    logger.info(
      {
        userId: input.userId,
        transferId: input.transferId,
        riskScore,
        status,
        flags,
      },
      "AML check performed",
    );

    return {
      passed: status === "passed",
      riskScore,
      flags,
      requiresManualReview,
    };
  }

  /**
   * Create a compliance log entry
   */
  createLog(input: {
    userId: string;
    transferId?: string;
    checkType: ComplianceCheckType;
    status: ComplianceCheckStatus;
    riskScore: number;
    flags: string[];
    metadata: Record<string, unknown>;
    checkedBy: string;
    notes?: string;
  }): ComplianceLog {
    const log: ComplianceLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId: input.userId,
      transferId: input.transferId,
      checkType: input.checkType,
      status: input.status,
      riskScore: input.riskScore,
      flags: input.flags,
      metadata: input.metadata,
      checkedAt: new Date().toISOString(),
      checkedBy: input.checkedBy,
      notes: input.notes,
    };

    this.logs.push(log);

    void this.eventBus.publish({
      type: "compliance.log_created",
      timestamp: log.checkedAt,
      payload: {
        logId: log.id,
        userId: log.userId,
        checkType: log.checkType,
        status: log.status,
        riskScore: log.riskScore,
      },
    });

    return log;
  }

  /**
   * Get logs for a specific user
   */
  getLogsByUserId(userId: string, limit = 50): ComplianceLog[] {
    return this.logs
      .filter((log) => log.userId === userId)
      .sort(
        (a, b) =>
          new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime(),
      )
      .slice(0, limit);
  }

  /**
   * Get logs for a specific transfer
   */
  getLogsByTransferId(transferId: string): ComplianceLog[] {
    return this.logs
      .filter((log) => log.transferId === transferId)
      .sort(
        (a, b) =>
          new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime(),
      );
  }

  /**
   * Get all flagged transactions (admin view)
   */
  getFlaggedTransactions(limit = 100): ComplianceLog[] {
    return this.logs
      .filter(
        (log) =>
          log.status === "flagged" ||
          log.status === "blocked" ||
          log.status === "manual_review",
      )
      .sort(
        (a, b) =>
          new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime(),
      )
      .slice(0, limit);
  }

  /**
   * Get all logs (admin view)
   */
  getAllLogs(filters?: {
    checkType?: ComplianceCheckType;
    status?: ComplianceCheckStatus;
    minRiskScore?: number;
    limit?: number;
  }): ComplianceLog[] {
    let filtered = [...this.logs];

    if (filters?.checkType) {
      filtered = filtered.filter((log) => log.checkType === filters.checkType);
    }

    if (filters?.status) {
      filtered = filtered.filter((log) => log.status === filters.status);
    }

    if (filters?.minRiskScore !== undefined) {
      filtered = filtered.filter(
        (log) => log.riskScore >= filters.minRiskScore!,
      );
    }

    return filtered
      .sort(
        (a, b) =>
          new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime(),
      )
      .slice(0, filters?.limit || 100);
  }

  /**
   * Update log with admin notes
   */
  updateLogNotes(
    logId: string,
    notes: string,
    adminUserId: string,
  ): ComplianceLog | null {
    const log = this.logs.find((l) => l.id === logId);
    if (!log) return null;

    log.notes = notes;
    log.metadata = {
      ...log.metadata,
      lastUpdatedBy: adminUserId,
      lastUpdatedAt: new Date().toISOString(),
    };

    return log;
  }
}
