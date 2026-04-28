import { apiFetch } from "./api";

export type ErrorSeverity = "low" | "medium" | "high" | "critical";
export type ErrorCategory =
  | "network"
  | "validation"
  | "authentication"
  | "authorization"
  | "payment"
  | "system"
  | "unknown";

interface LogErrorOptions {
  severity?: ErrorSeverity;
  category?: ErrorCategory;
  metadata?: Record<string, unknown>;
}

/**
 * Log an error to the backend error logging system
 */
export async function logError(
  error: Error | string,
  options: LogErrorOptions = {},
): Promise<void> {
  try {
    const message = typeof error === "string" ? error : error.message;
    const stack = typeof error === "string" ? undefined : error.stack;

    await apiFetch("/errors/log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "frontend",
        severity: options.severity || "medium",
        category: options.category || "unknown",
        message,
        stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        metadata: options.metadata,
      }),
    });
  } catch (loggingError) {
    // Don't throw if logging fails - just log to console
    console.error("Failed to log error to backend:", loggingError);
  }
}

/**
 * Categorize error based on error message or type
 */
export function categorizeError(error: Error | string): ErrorCategory {
  const message = typeof error === "string" ? error : error.message;
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("network") ||
    lowerMessage.includes("fetch") ||
    lowerMessage.includes("timeout")
  ) {
    return "network";
  }
  if (lowerMessage.includes("validation") || lowerMessage.includes("invalid")) {
    return "validation";
  }
  if (lowerMessage.includes("auth") || lowerMessage.includes("unauthorized")) {
    return "authentication";
  }
  if (
    lowerMessage.includes("forbidden") ||
    lowerMessage.includes("permission")
  ) {
    return "authorization";
  }
  if (
    lowerMessage.includes("payment") ||
    lowerMessage.includes("transfer") ||
    lowerMessage.includes("stellar")
  ) {
    return "payment";
  }

  return "unknown";
}

/**
 * Determine error severity based on error type
 */
export function determineSeverity(error: Error | string): ErrorSeverity {
  const message = typeof error === "string" ? error : error.message;
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("critical") || lowerMessage.includes("fatal")) {
    return "critical";
  }
  if (
    lowerMessage.includes("payment failed") ||
    lowerMessage.includes("transaction failed")
  ) {
    return "high";
  }
  if (lowerMessage.includes("warning") || lowerMessage.includes("validation")) {
    return "medium";
  }

  return "low";
}

/**
 * Log error with automatic categorization and severity detection
 */
export async function logErrorAuto(
  error: Error | string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const category = categorizeError(error);
  const severity = determineSeverity(error);

  await logError(error, { severity, category, metadata });
}
