import { logger } from "../../logger";
import type { EventBus } from "../../core/eventBus";

export type ErrorSeverity = "low" | "medium" | "high" | "critical";
export type ErrorSource = "frontend" | "backend" | "stellar" | "external";
export type ErrorCategory =
  | "network"
  | "validation"
  | "authentication"
  | "authorization"
  | "payment"
  | "system"
  | "unknown";

export interface ErrorLog {
  id: string;
  source: ErrorSource;
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  stack?: string;
  userId?: string;
  sessionId?: string;
  url?: string;
  userAgent?: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  notes?: string;
}

export interface ErrorStats {
  total: number;
  bySource: Record<ErrorSource, number>;
  bySeverity: Record<ErrorSeverity, number>;
  byCategory: Record<ErrorCategory, number>;
  unresolved: number;
  last24Hours: number;
}

export class ErrorLogService {
  private logs: ErrorLog[] = [];

  constructor(private readonly eventBus: EventBus) {}

  /**
   * Log an error
   */
  logError(input: {
    source: ErrorSource;
    severity: ErrorSeverity;
    category: ErrorCategory;
    message: string;
    stack?: string;
    userId?: string;
    sessionId?: string;
    url?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }): ErrorLog {
    const errorLog: ErrorLog = {
      id: `error_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      source: input.source,
      severity: input.severity,
      category: input.category,
      message: input.message,
      stack: input.stack,
      userId: input.userId,
      sessionId: input.sessionId,
      url: input.url,
      userAgent: input.userAgent,
      metadata: input.metadata || {},
      occurredAt: new Date().toISOString(),
      resolved: false,
    };

    this.logs.push(errorLog);

    // Log to system logger
    logger.error(
      {
        errorId: errorLog.id,
        source: errorLog.source,
        severity: errorLog.severity,
        category: errorLog.category,
        userId: errorLog.userId,
      },
      `Error logged: ${errorLog.message}`,
    );

    // Publish event
    void this.eventBus.publish({
      type: "error.logged",
      timestamp: errorLog.occurredAt,
      payload: {
        errorId: errorLog.id,
        source: errorLog.source,
        severity: errorLog.severity,
        category: errorLog.category,
      },
    });

    return errorLog;
  }

  /**
   * Get all errors with optional filters
   */
  getErrors(filters?: {
    source?: ErrorSource;
    severity?: ErrorSeverity;
    category?: ErrorCategory;
    resolved?: boolean;
    userId?: string;
    limit?: number;
  }): ErrorLog[] {
    let filtered = [...this.logs];

    if (filters?.source) {
      filtered = filtered.filter((log) => log.source === filters.source);
    }

    if (filters?.severity) {
      filtered = filtered.filter((log) => log.severity === filters.severity);
    }

    if (filters?.category) {
      filtered = filtered.filter((log) => log.category === filters.category);
    }

    if (filters?.resolved !== undefined) {
      filtered = filtered.filter((log) => log.resolved === filters.resolved);
    }

    if (filters?.userId) {
      filtered = filtered.filter((log) => log.userId === filters.userId);
    }

    return filtered
      .sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      )
      .slice(0, filters?.limit || 100);
  }

  /**
   * Get error by ID
   */
  getErrorById(errorId: string): ErrorLog | null {
    return this.logs.find((log) => log.id === errorId) || null;
  }

  /**
   * Get error statistics
   */
  getStats(): ErrorStats {
    const now = Date.now();
    const last24Hours = now - 24 * 60 * 60 * 1000;

    const stats: ErrorStats = {
      total: this.logs.length,
      bySource: { frontend: 0, backend: 0, stellar: 0, external: 0 },
      bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      byCategory: {
        network: 0,
        validation: 0,
        authentication: 0,
        authorization: 0,
        payment: 0,
        system: 0,
        unknown: 0,
      },
      unresolved: 0,
      last24Hours: 0,
    };

    this.logs.forEach((log) => {
      stats.bySource[log.source]++;
      stats.bySeverity[log.severity]++;
      stats.byCategory[log.category]++;

      if (!log.resolved) {
        stats.unresolved++;
      }

      if (new Date(log.occurredAt).getTime() > last24Hours) {
        stats.last24Hours++;
      }
    });

    return stats;
  }

  /**
   * Mark error as resolved
   */
  resolveError(
    errorId: string,
    resolvedBy: string,
    notes?: string,
  ): ErrorLog | null {
    const log = this.logs.find((l) => l.id === errorId);
    if (!log) return null;

    log.resolved = true;
    log.resolvedAt = new Date().toISOString();
    log.resolvedBy = resolvedBy;
    if (notes) {
      log.notes = notes;
    }

    void this.eventBus.publish({
      type: "error.resolved",
      timestamp: log.resolvedAt,
      payload: {
        errorId: log.id,
        resolvedBy,
      },
    });

    return log;
  }

  /**
   * Update error notes
   */
  updateNotes(errorId: string, notes: string): ErrorLog | null {
    const log = this.logs.find((l) => l.id === errorId);
    if (!log) return null;

    log.notes = notes;
    return log;
  }

  /**
   * Delete old resolved errors (cleanup)
   */
  cleanupOldErrors(daysToKeep = 30): number {
    const cutoffDate = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    const initialCount = this.logs.length;

    this.logs = this.logs.filter((log) => {
      if (!log.resolved) return true;
      return new Date(log.occurredAt).getTime() > cutoffDate;
    });

    const deletedCount = initialCount - this.logs.length;
    if (deletedCount > 0) {
      logger.info({ deletedCount, daysToKeep }, "Cleaned up old error logs");
    }

    return deletedCount;
  }
}
