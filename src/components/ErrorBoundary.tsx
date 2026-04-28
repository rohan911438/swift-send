import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { logError } from "@/lib/errorLogger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Ignore MetaMask and other wallet extension errors
    if (
      error.message?.includes("MetaMask") ||
      error.message?.includes("wallet") ||
      error.stack?.includes("chrome-extension")
    ) {
      console.warn("Browser extension error (ignored):", error.message);
      this.setState({ hasError: false });
      return;
    }

    console.error("Application error:", error, errorInfo);

    // Log error to backend
    logError(error, {
      severity: "critical",
      category: "system",
      metadata: {
        componentStack: errorInfo.componentStack,
      },
    }).catch((loggingError) => {
      console.error("Failed to log error:", loggingError);
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 mx-auto rounded-full bg-warning/20 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-warning" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">
              Something went wrong
            </h1>
            <p className="text-muted-foreground mb-6">
              We encountered an unexpected error. Please try refreshing the
              page.
            </p>
            <Button onClick={this.handleReload} variant="hero">
              <RefreshCw className="w-4 h-4" />
              Refresh Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
