/**
 * Reusable fee display component
 * Provides consistent fee display across the application
 */

import React from "react";
import { Info, Shield, ArrowRight, Zap, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FeeCalculationResult } from "@/lib/feeCalculator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FeeDisplayProps {
  fees: FeeCalculationResult;
  variant?: "compact" | "detailed" | "minimal";
  showSavings?: boolean;
  className?: string;
}

function FeeTooltip({ content }: { content: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 cursor-help hover:text-muted-foreground transition-colors" />
        </TooltipTrigger>
        <TooltipContent className="max-w-[220px] text-xs leading-relaxed">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Compact fee display (single line) — shows total with effective rate
 */
export function CompactFeeDisplay({
  fees,
  className,
}: Omit<FeeDisplayProps, "variant">) {
  const effectiveRate = fees.amount > 0
    ? ((fees.totalFee / fees.amount) * 100).toFixed(2)
    : "0.00";

  return (
    <div className={cn("flex items-center justify-between text-sm", className)}>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span>Total fees</span>
        <FeeTooltip content="Combined Stellar network fee + SwiftSend service fee. Both are deducted from your send amount." />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">({effectiveRate}%)</span>
        <span className="font-semibold text-foreground">
          ${fees.totalFee.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

/**
 * Minimal fee display (just the amount)
 */
export function MinimalFeeDisplay({
  fees,
  className,
}: Omit<FeeDisplayProps, "variant">) {
  return (
    <span className={cn("font-semibold text-foreground", className)}>
      ${fees.totalFee.toFixed(2)}
    </span>
  );
}

/**
 * Detailed fee display with full breakdown, tooltips, and savings comparison
 */
export function DetailedFeeDisplay({
  fees,
  showSavings = false,
  className,
}: Omit<FeeDisplayProps, "variant">) {
  const traditionalFee = fees.amount * 0.02;
  const savings = traditionalFee - fees.totalFee;
  const networkFeePercent = fees.amount > 0
    ? ((fees.networkFee / fees.amount) * 100).toFixed(4)
    : "0.0000";
  const effectiveTotalRate = fees.amount > 0
    ? ((fees.totalFee / fees.amount) * 100).toFixed(2)
    : "0.00";

  return (
    <div className={cn("space-y-3", className)}>
      {/* Network Fee row */}
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Zap className="w-4 h-4 text-blue-500 shrink-0" />
          <span>Stellar network fee</span>
          <FeeTooltip content="A tiny fixed fee paid to Stellar validators to process your transaction on the blockchain. Currently ~0.00001 XLM, converted to USD. This goes to the network, not SwiftSend." />
        </div>
        <div className="flex items-center gap-1.5 text-right">
          <span className="text-xs text-muted-foreground">({networkFeePercent}%)</span>
          <span className="font-medium text-foreground tabular-nums">
            ${fees.networkFee.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Service Fee row */}
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Shield className="w-4 h-4 text-green-500 shrink-0" />
          <span>SwiftSend service fee</span>
          <FeeTooltip content="SwiftSend's fee for compliance monitoring, fraud detection, escrow management, and 24/7 customer support. Calculated as a percentage of your send amount, subject to a minimum and maximum cap." />
        </div>
        <div className="flex items-center gap-1.5 text-right">
          <span className="text-xs text-muted-foreground">
            ({fees.feePercentage.toFixed(2)}%)
          </span>
          <span className="font-medium text-foreground tabular-nums">
            ${fees.serviceFee.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Total Fee */}
      <div className="border-t border-border/50 pt-3">
        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span>Total fees</span>
            <FeeTooltip content={`Effective rate: ${effectiveTotalRate}% of your send amount. This includes both the Stellar network fee and SwiftSend's service fee.`} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">({effectiveTotalRate}%)</span>
            <span className="font-semibold text-foreground tabular-nums">
              ${fees.totalFee.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Recipient Gets */}
      <div className="bg-gradient-to-r from-green-50 to-green-50/50 dark:from-green-900/20 dark:to-green-900/10 rounded-lg p-3 border border-green-200/50 dark:border-green-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-green-600 shrink-0" />
            <div>
              <span className="text-sm font-semibold text-foreground">
                Recipient receives
              </span>
              <p className="text-xs text-muted-foreground">
                After all fees · arrives in ~5 seconds
              </p>
            </div>
          </div>
          <span className="text-lg font-bold text-green-600 tabular-nums">
            ${fees.recipientGets.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Savings Comparison */}
      {showSavings && savings > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200/50 dark:border-blue-800/50">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              vs. traditional bank wire
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground">Bank wire fee (≈2%)</p>
              <p className="font-semibold text-foreground">${traditionalFee.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">SwiftSend fee ({effectiveTotalRate}%)</p>
              <p className="font-semibold text-green-600">${fees.totalFee.toFixed(2)}</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-blue-200/50 dark:border-blue-800/50 flex justify-between text-xs">
            <span className="text-blue-700 dark:text-blue-300 font-medium">You save</span>
            <span className="font-bold text-green-600">${savings.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main fee display component with variant selection
 */
export function FeeDisplay({
  fees,
  variant = "detailed",
  showSavings = false,
  className,
}: FeeDisplayProps) {
  switch (variant) {
    case "compact":
      return <CompactFeeDisplay fees={fees} className={className} />;
    case "minimal":
      return <MinimalFeeDisplay fees={fees} className={className} />;
    case "detailed":
    default:
      return (
        <DetailedFeeDisplay
          fees={fees}
          showSavings={showSavings}
          className={className}
        />
      );
  }
}

/**
 * Fee comparison card
 */
export function FeeComparisonCard({
  amount,
  fees,
  className,
}: {
  amount: number;
  fees: FeeCalculationResult;
  className?: string;
}) {
  const traditionalFee = amount * 0.02;
  const savings = traditionalFee - fees.totalFee;
  const savingsPercentage = traditionalFee > 0
    ? (savings / traditionalFee) * 100
    : 0;
  const effectiveRate = amount > 0
    ? ((fees.totalFee / amount) * 100).toFixed(2)
    : "0.00";

  return (
    <div
      className={cn(
        "bg-card rounded-lg p-4 border border-border/50",
        className,
      )}
    >
      <div className="grid grid-cols-2 gap-4">
        {/* Traditional */}
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-1">
            Traditional wire
          </p>
          <p className="text-lg font-bold text-foreground">
            ${traditionalFee.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">2.00% · 1–3 business days</p>
        </div>

        {/* SwiftSend */}
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-1">
            SwiftSend
          </p>
          <p className="text-lg font-bold text-green-600">
            ${fees.totalFee.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">
            {effectiveRate}% · ~5 seconds
          </p>
        </div>
      </div>

      {/* Savings */}
      <div className="mt-4 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-foreground">You save</span>
            <FeeTooltip content="Compared to a typical 2% international wire transfer fee at a traditional bank." />
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-green-600">
              ${savings.toFixed(2)}
            </p>
            <p className="text-xs text-green-600">
              {savingsPercentage.toFixed(0)}% cheaper
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Fee tier badge
 */
export function FeeTierBadge({
  amount,
  className,
}: {
  amount: number;
  className?: string;
}) {
  const getTierInfo = (amount: number) => {
    if (amount < 10)
      return { tier: "Micro", color: "bg-gray-100 text-gray-800" };
    if (amount < 100)
      return { tier: "Small", color: "bg-blue-100 text-blue-800" };
    if (amount < 1000)
      return { tier: "Medium", color: "bg-green-100 text-green-800" };
    if (amount < 10000)
      return { tier: "Large", color: "bg-purple-100 text-purple-800" };
    return { tier: "Enterprise", color: "bg-amber-100 text-amber-800" };
  };

  const { tier, color } = getTierInfo(amount);

  return (
    <span
      className={cn(
        "px-2 py-1 rounded-full text-xs font-medium",
        color,
        className,
      )}
    >
      {tier}
    </span>
  );
}
