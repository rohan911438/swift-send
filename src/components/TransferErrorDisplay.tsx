import React from "react";
import {
  AlertTriangle,
  AlertCircle,
  Zap,
  RefreshCw,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransferError } from "@/lib/errorHandling";

interface TransferErrorDisplayProps {
  error: TransferError;
  onRetry?: () => void;
  onDismiss?: () => void;
  isRetrying?: boolean;
}

/**
 * Displays transfer errors with user-friendly messages and recovery actions
 */
export function TransferErrorDisplay({
  error,
  onRetry,
  onDismiss,
  isRetrying = false,
}: TransferErrorDisplayProps) {
  const getErrorIcon = () => {
    switch (error.category) {
      case "insufficient_balance":
        return <AlertCircle className="w-5 h-5" />;
      case "network_error":
      case "timeout_error":
        return <Zap className="w-5 h-5" />;
      case "stellar_error":
        return <AlertTriangle className="w-5 h-5" />;
      case "compliance_error":
        return <AlertTriangle className="w-5 h-5" />;
      case "authentication_error":
        return <AlertCircle className="w-5 h-5" />;
      default:
        return <AlertTriangle className="w-5 h-5" />;
    }
  };

  const getErrorColor = () => {
    switch (error.category) {
      case "insufficient_balance":
        return "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-900 dark:text-orange-100";
      case "network_error":
      case "timeout_error":
        return "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-900 dark:text-yellow-100";
      case "stellar_error":
        return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100";
      case "compliance_error":
        return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100";
      case "authentication_error":
        return "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100";
      default:
        return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100";
    }
  };

  const getErrorTitle = () => {
    switch (error.category) {
      case "insufficient_balance":
        return "Insufficient Balance";
      case "network_error":
        return "Network Connection Error";
      case "timeout_error":
        return "Request Timeout";
      case "stellar_error":
        return "Stellar Network Error";
      case "compliance_error":
        return "Transfer Blocked";
      case "authentication_error":
        return "Session Expired";
      case "validation_error":
        return "Invalid Transfer Details";
      default:
        return "Transfer Failed";
    }
  };

  return (
    <div className={`rounded-xl border p-4 ${getErrorColor()}`}>
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">{getErrorIcon()}</div>
        <div className="flex-1">
          <h3 className="font-semibold mb-1">{getErrorTitle()}</h3>
          <p className="text-sm mb-3">{error.userMessage}</p>

          {/* Recovery Actions */}
          {error.recoveryActions && error.recoveryActions.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium mb-2 opacity-75">
                What you can do:
              </p>
              <ul className="text-xs space-y-1 opacity-90">
                {error.recoveryActions.map((action, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="flex-shrink-0">•</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            {error.retryable && onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                disabled={isRetrying}
                className="gap-1"
              >
                {isRetrying ? (
                  <>
                    <div className="animate-spin w-3 h-3 border-2 border-current/30 border-t-current rounded-full" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3" />
                    Try Again
                  </>
                )}
              </Button>
            )}
            {onDismiss && (
              <Button size="sm" variant="ghost" onClick={onDismiss}>
                Dismiss
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="gap-1"
              onClick={() => {
                // Open support or help
                window.open("https://support.example.com", "_blank");
              }}
            >
              <HelpCircle className="w-3 h-3" />
              Get Help
            </Button>
          </div>

          {/* Debug Info (only in development) */}
          {process.env.NODE_ENV === "development" && error.details && (
            <details className="mt-3 text-xs opacity-75">
              <summary className="cursor-pointer font-mono">Debug Info</summary>
              <pre className="mt-2 p-2 bg-black/10 rounded overflow-auto max-h-40">
                {JSON.stringify(error.details, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
