/**
 * Reusable fee display component
 * Provides consistent fee display across the application
 */

import React from "react";
import { Info, Star, Shield, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { FeeCalculationResult } from "@/lib/feeCalculator";

interface FeeDisplayProps {
  fees: FeeCalculationResult;
  variant?: "compact" | "detailed" | "minimal";
  showSavings?: boolean;
  className?: string;
}

/**
 * Compact fee display (single line)
 */
export function CompactFeeDisplay({
  fees,
  className,
}: Omit<FeeDisplayProps, "variant">) {
  return (
    <div className={cn("flex items-center justify-between text-sm", className)}>
      <span className="text-muted-foreground">Total fees</span>
      <span className="font-semibold text-foreground">
        ${fees.totalFee.toFixed(2)}
      </span>
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
 * Detailed fee display with breakdown
 */
export function DetailedFeeDisplay({
  fees,
  showSavings = false,
  className,
}: Omit<FeeDisplayProps, "variant">) {
  const traditionalFee = fees.amount * 0.02; // 2% traditional fee
  const savings = traditionalFee - fees.totalFee;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Network Fee */}
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Star className="w-4 h-4 text-blue-500" />
          <span>Stellar network fee</span>
        </div>
        <span className="font-medium text-foreground">
          ${fees.networkFee.toFixed(4)}
        </span>
      </div>

      {/* Service Fee */}
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Shield className="w-4 h-4 text-green-500" />
          <span>Service fee ({fees.feePercentage.toFixed(2)}%)</span>
        </div>
        <span className="font-medium text-foreground">
          ${fees.serviceFee.toFixed(2)}
        </span>
      </div>

      {/* Total Fee */}
      <div className="border-t border-border/50 pt-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Total fees</span>
          <span className="font-semibold text-foreground">
            ${fees.totalFee.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Recipient Gets */}
      <div className="bg-gradient-to-r from-green-50 to-green-50/50 dark:from-green-900/20 dark:to-green-900/10 rounded-lg p-3 border border-green-200/50 dark:border-green-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold text-foreground">
              Recipient receives
            </span>
          </div>
          <span className="text-lg font-bold text-green-600">
            ${fees.recipientGets.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Savings Comparison */}
      {showSavings && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200/50 dark:border-blue-800/50">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Savings vs traditional wire
            </span>
          </div>
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p>Traditional fee: ${traditionalFee.toFixed(2)} (2%)</p>
            <p className="font-semibold text-green-600 dark:text-green-400">
              You save: ${savings.toFixed(2)}
            </p>
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
  const savingsPercentage = (savings / traditionalFee) * 100;

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
          <p className="text-xs text-muted-foreground font-medium mb-2">
            Traditional Wire
          </p>
          <p className="text-lg font-bold text-foreground">
            ${traditionalFee.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">2% fee • 1-3 days</p>
        </div>

        {/* SwiftSend */}
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-2">
            SwiftSend
          </p>
          <p className="text-lg font-bold text-green-600">
            ${fees.totalFee.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">
            {fees.feePercentage.toFixed(2)}% fee • 3-5 seconds
          </p>
        </div>
      </div>

      {/* Savings */}
      <div className="mt-4 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">You save</span>
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
