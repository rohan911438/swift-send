/**
 * Transfer logging utility for debugging and monitoring
 * Logs transfer events with structured data for better debugging
 */

export interface TransferLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  event: string;
  transferId?: string;
  userId?: string;
  amount?: number;
  currency?: string;
  message?: string;
  error?: {
    category?: string;
    message?: string;
    statusCode?: number;
  };
  metadata?: Record<string, unknown>;
}

class TransferLogger {
  private logs: TransferLogEntry[] = [];
  private maxLogs = 100;
  private isDevelopment = process.env.NODE_ENV === "development";

  /**
   * Log transfer event
   */
  log(entry: Omit<TransferLogEntry, "timestamp">) {
    const logEntry: TransferLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    this.logs.push(logEntry);

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Log to console in development
    if (this.isDevelopment) {
      this.logToConsole(logEntry);
    }

    // Send to analytics/monitoring service in production
    if (!this.isDevelopment && entry.level === "error") {
      this.sendToMonitoring(logEntry);
    }
  }

  /**
   * Log transfer initiation
   */
  logTransferInitiated(
    transferId: string,
    amount: number,
    currency: string,
    userId?: string,
  ) {
    this.log({
      level: "info",
      event: "transfer_initiated",
      transferId,
      userId,
      amount,
      currency,
      message: `Transfer initiated: ${amount} ${currency}`,
    });
  }

  /**
   * Log transfer submission
   */
  logTransferSubmitted(transferId: string, userId?: string) {
    this.log({
      level: "info",
      event: "transfer_submitted",
      transferId,
      userId,
      message: "Transfer submitted to queue",
    });
  }

  /**
   * Log transfer processing
   */
  logTransferProcessing(transferId: string, userId?: string) {
    this.log({
      level: "info",
      event: "transfer_processing",
      transferId,
      userId,
      message: "Transfer is being processed",
    });
  }

  /**
   * Log transfer success
   */
  logTransferSuccess(
    transferId: string,
    amount: number,
    currency: string,
    userId?: string,
  ) {
    this.log({
      level: "info",
      event: "transfer_completed",
      transferId,
      userId,
      amount,
      currency,
      message: `Transfer completed successfully: ${amount} ${currency}`,
    });
  }

  /**
   * Log transfer failure
   */
  logTransferError(
    transferId: string,
    category: string,
    message: string,
    statusCode?: number,
    userId?: string,
    metadata?: Record<string, unknown>,
  ) {
    this.log({
      level: "error",
      event: "transfer_failed",
      transferId,
      userId,
      message: `Transfer failed: ${message}`,
      error: {
        category,
        message,
        statusCode,
      },
      metadata,
    });
  }

  /**
   * Log validation error
   */
  logValidationError(
    field: string,
    value: unknown,
    reason: string,
    userId?: string,
  ) {
    this.log({
      level: "warn",
      event: "validation_error",
      userId,
      message: `Validation error on ${field}: ${reason}`,
      metadata: {
        field,
        value,
        reason,
      },
    });
  }

  /**
   * Log network error
   */
  logNetworkError(
    endpoint: string,
    statusCode: number,
    message: string,
    userId?: string,
  ) {
    this.log({
      level: "error",
      event: "network_error",
      userId,
      message: `Network error calling ${endpoint}: ${message}`,
      error: {
        message,
        statusCode,
      },
      metadata: {
        endpoint,
      },
    });
  }

  /**
   * Log compliance check
   */
  logComplianceCheck(
    amount: number,
    destination: string,
    canProceed: boolean,
    blockers?: string[],
    userId?: string,
  ) {
    this.log({
      level: canProceed ? "info" : "warn",
      event: "compliance_check",
      userId,
      amount,
      message: `Compliance check: ${canProceed ? "approved" : "blocked"}`,
      metadata: {
        destination,
        blockers,
      },
    });
  }

  /**
   * Log queue status check
   */
  logQueueStatusCheck(
    jobId: string,
    status: string,
    error?: string,
    userId?: string,
  ) {
    this.log({
      level: error ? "error" : "debug",
      event: "queue_status_check",
      userId,
      message: `Queue status: ${status}`,
      metadata: {
        jobId,
        error,
      },
    });
  }

  /**
   * Get all logs
   */
  getLogs(): TransferLogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs for a specific transfer
   */
  getTransferLogs(transferId: string): TransferLogEntry[] {
    return this.logs.filter((log) => log.transferId === transferId);
  }

  /**
   * Get logs for a specific user
   */
  getUserLogs(userId: string): TransferLogEntry[] {
    return this.logs.filter((log) => log.userId === userId);
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Log to console with formatting
   */
  private logToConsole(entry: TransferLogEntry) {
    const style = this.getConsoleStyle(entry.level);
    const prefix = `[${entry.level.toUpperCase()}] ${entry.event}`;

    console.log(`%c${prefix}`, style, {
      timestamp: entry.timestamp,
      transferId: entry.transferId,
      userId: entry.userId,
      message: entry.message,
      error: entry.error,
      metadata: entry.metadata,
    });
  }

  /**
   * Get console style based on log level
   */
  private getConsoleStyle(level: string): string {
    const styles: Record<string, string> = {
      info: "color: #0066cc; font-weight: bold;",
      warn: "color: #ff9900; font-weight: bold;",
      error: "color: #cc0000; font-weight: bold;",
      debug: "color: #666666; font-weight: normal;",
    };
    return styles[level] || styles.debug;
  }

  /**
   * Send error logs to monitoring service
   */
  private sendToMonitoring(entry: TransferLogEntry) {
    // This would typically send to a service like Sentry, LogRocket, etc.
    // For now, we'll just log it
    if (entry.level === "error") {
      console.error("Monitoring:", entry);
    }
  }
}

// Export singleton instance
export const transferLogger = new TransferLogger();
