/**
 * Comprehensive error handling for USDC transfers
 * Categorizes errors and provides user-friendly messages with recovery suggestions
 */

export type ErrorCategory =
  | "insufficient_balance"
  | "network_error"
  | "stellar_error"
  | "compliance_error"
  | "validation_error"
  | "authentication_error"
  | "timeout_error"
  | "unknown_error";

export interface TransferError {
  category: ErrorCategory;
  message: string;
  userMessage: string;
  details?: Record<string, unknown>;
  recoveryActions?: string[];
  retryable: boolean;
  statusCode?: number;
}

/**
 * Parse API error responses and categorize them
 */
export function parseTransferError(error: unknown): TransferError {
  // Handle network/fetch errors
  if (error instanceof TypeError) {
    if (error.message.includes("fetch")) {
      return {
        category: "network_error",
        message: error.message,
        userMessage:
          "Network connection failed. Please check your internet connection and try again.",
        recoveryActions: [
          "Check your internet connection",
          "Try again in a few moments",
        ],
        retryable: true,
      };
    }
  }

  // Handle Error objects with structured data
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Insufficient balance
    if (message.includes("insufficient") || message.includes("balance")) {
      return {
        category: "insufficient_balance",
        message: error.message,
        userMessage:
          "You don't have enough USDC to complete this transfer. Please check your balance and try a smaller amount.",
        recoveryActions: [
          "Reduce the transfer amount",
          "Add funds to your wallet",
          "Check your available balance",
        ],
        retryable: false,
      };
    }

    // Compliance/limit errors
    if (
      message.includes("compliance") ||
      message.includes("limit") ||
      message.includes("exceed")
    ) {
      return {
        category: "compliance_error",
        message: error.message,
        userMessage:
          "This transfer exceeds your account limits. Upgrade your account or reduce the amount.",
        recoveryActions: [
          "Reduce the transfer amount",
          "Upgrade your account for higher limits",
          "Contact support",
        ],
        retryable: false,
      };
    }

    // Stellar network errors
    if (
      message.includes("stellar") ||
      message.includes("horizon") ||
      message.includes("network")
    ) {
      return {
        category: "stellar_error",
        message: error.message,
        userMessage:
          "The Stellar network is experiencing issues. Your transfer will be retried automatically.",
        recoveryActions: [
          "Wait a moment and try again",
          "Check Stellar network status",
          "Contact support if issue persists",
        ],
        retryable: true,
      };
    }

    // Validation errors
    if (message.includes("invalid") || message.includes("validation")) {
      return {
        category: "validation_error",
        message: error.message,
        userMessage: "Please check your transfer details and try again.",
        recoveryActions: [
          "Verify recipient information",
          "Check the transfer amount",
          "Try again",
        ],
        retryable: false,
      };
    }

    // Authentication errors
    if (
      message.includes("auth") ||
      message.includes("session") ||
      message.includes("signed in")
    ) {
      return {
        category: "authentication_error",
        message: error.message,
        userMessage:
          "Your session has expired. Please sign in again to continue.",
        recoveryActions: ["Sign in again", "Refresh the page"],
        retryable: false,
      };
    }

    // Timeout errors
    if (message.includes("timeout") || message.includes("timed out")) {
      return {
        category: "timeout_error",
        message: error.message,
        userMessage: "The request took too long. Please try again.",
        recoveryActions: [
          "Try again",
          "Check your internet connection",
          "Wait a moment and retry",
        ],
        retryable: true,
      };
    }

    // Generic error message
    return {
      category: "unknown_error",
      message: error.message,
      userMessage:
        error.message || "An unexpected error occurred. Please try again.",
      retryable: true,
    };
  }

  // Handle response objects with error details
  if (typeof error === "object" && error !== null) {
    const errorObj = error as Record<string, unknown>;

    if (errorObj.error) {
      return parseTransferError(new Error(String(errorObj.error)));
    }

    if (errorObj.message) {
      return parseTransferError(new Error(String(errorObj.message)));
    }

    if (errorObj.details) {
      const details = errorObj.details as Record<string, unknown>;

      // Check for specific Stellar error codes
      if (details.resultCodes) {
        const resultCodes = details.resultCodes as Record<string, unknown>;

        if (resultCodes.transaction === "tx_insufficient_balance") {
          return {
            category: "insufficient_balance",
            message: "Insufficient balance on Stellar network",
            userMessage:
              "The distribution account has insufficient balance. Please contact support.",
            details,
            recoveryActions: ["Contact support"],
            retryable: false,
            statusCode: 502,
          };
        }

        if (resultCodes.transaction === "tx_bad_seq") {
          return {
            category: "stellar_error",
            message: "Transaction sequence error",
            userMessage:
              "A temporary issue occurred. Your transfer will be retried automatically.",
            details,
            recoveryActions: [
              "Wait and retry",
              "Contact support if issue persists",
            ],
            retryable: true,
            statusCode: 502,
          };
        }

        if (resultCodes.operations) {
          const ops = resultCodes.operations as unknown[];
          if (Array.isArray(ops) && ops[0] === "op_underfunded") {
            return {
              category: "insufficient_balance",
              message: "Operation underfunded",
              userMessage:
                "Insufficient funds for this transfer. Please check your balance.",
              details,
              recoveryActions: [
                "Reduce the transfer amount",
                "Add funds to your account",
              ],
              retryable: false,
              statusCode: 502,
            };
          }
        }
      }

      // Check for compliance/limit errors in details
      if (details.blockers && Array.isArray(details.blockers)) {
        const blockers = details.blockers as string[];
        return {
          category: "compliance_error",
          message: blockers.join("; "),
          userMessage: `Transfer blocked: ${blockers.join("; ")}`,
          details,
          recoveryActions: [
            "Reduce the transfer amount",
            "Upgrade your account",
            "Contact support",
          ],
          retryable: false,
          statusCode: 400,
        };
      }
    }
  }

  // Fallback for unknown error types
  return {
    category: "unknown_error",
    message: String(error),
    userMessage: "An unexpected error occurred. Please try again.",
    recoveryActions: ["Try again", "Contact support if issue persists"],
    retryable: true,
  };
}

/**
 * Extract specific error information from API responses
 */
export function extractErrorDetails(
  response: Response,
  body: unknown,
): Record<string, unknown> {
  const details: Record<string, unknown> = {
    statusCode: response.status,
    statusText: response.statusText,
  };

  if (typeof body === "object" && body !== null) {
    const bodyObj = body as Record<string, unknown>;
    if (bodyObj.error) details.error = bodyObj.error;
    if (bodyObj.details) details.details = bodyObj.details;
    if (bodyObj.message) details.message = bodyObj.message;
  }

  return details;
}

/**
 * Determine if an error is retryable
 */
export function isRetryableError(error: TransferError): boolean {
  return error.retryable && error.category !== "authentication_error";
}

/**
 * Format error for logging
 */
export function formatErrorForLogging(
  error: TransferError,
  context?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    timestamp: new Date().toISOString(),
    category: error.category,
    message: error.message,
    statusCode: error.statusCode,
    retryable: error.retryable,
    details: error.details,
    context,
  };
}
