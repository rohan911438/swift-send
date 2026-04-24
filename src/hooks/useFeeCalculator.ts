/**
 * React hook for fee calculations
 * Provides memoized fee calculations for components
 */

import { useMemo, useCallback } from "react";
import {
  calculateTransferFees,
  calculateTransferFeesDetailed,
  calculateTransferFeesWithExchange,
  calculateSenderAmountFromRecipientAmount,
  calculateSavingsVsTraditional,
  FeeConfig,
  FeeCalculationResult,
  DetailedFeeBreakdown,
  DEFAULT_FEE_CONFIG,
  createFeeConfig,
} from "@/lib/feeCalculator";

interface UseFeeCalculatorOptions {
  config?: FeeConfig;
  exchangeRate?: number;
}

/**
 * Hook for calculating transfer fees
 * @param amount - Transfer amount
 * @param options - Configuration options
 * @returns Fee calculation result
 */
export function useFeeCalculator(
  amount: number,
  options: UseFeeCalculatorOptions = {},
): FeeCalculationResult {
  const { config = DEFAULT_FEE_CONFIG, exchangeRate } = options;

  return useMemo(() => {
    if (exchangeRate && exchangeRate !== 1) {
      return calculateTransferFeesWithExchange(amount, exchangeRate, config);
    }
    return calculateTransferFees(amount, config);
  }, [amount, config, exchangeRate]);
}

/**
 * Hook for detailed fee breakdown
 * @param amount - Transfer amount
 * @param options - Configuration options
 * @returns Detailed fee breakdown
 */
export function useFeeBreakdown(
  amount: number,
  options: UseFeeCalculatorOptions = {},
): DetailedFeeBreakdown {
  const { config = DEFAULT_FEE_CONFIG } = options;

  return useMemo(() => {
    return calculateTransferFeesDetailed(amount, config);
  }, [amount, config]);
}

/**
 * Hook for reverse fee calculation (from recipient amount)
 * @param recipientAmount - Amount recipient should receive
 * @param options - Configuration options
 * @returns Fee calculation result
 */
export function useSenderAmountFromRecipient(
  recipientAmount: number,
  options: UseFeeCalculatorOptions = {},
): FeeCalculationResult {
  const { config = DEFAULT_FEE_CONFIG } = options;

  return useMemo(() => {
    return calculateSenderAmountFromRecipientAmount(recipientAmount, config);
  }, [recipientAmount, config]);
}

/**
 * Hook for calculating savings vs traditional wire
 * @param amount - Transfer amount
 * @param traditionalFeePercentage - Traditional fee percentage
 * @param options - Configuration options
 * @returns Savings amount
 */
export function useSavingsVsTraditional(
  amount: number,
  traditionalFeePercentage: number = 0.02,
  options: UseFeeCalculatorOptions = {},
): number {
  const { config = DEFAULT_FEE_CONFIG } = options;

  return useMemo(() => {
    return calculateSavingsVsTraditional(
      amount,
      traditionalFeePercentage,
      config,
    );
  }, [amount, traditionalFeePercentage, config]);
}

/**
 * Hook for creating custom fee configuration
 * @param overrides - Partial fee configuration
 * @returns Complete fee configuration
 */
export function useCustomFeeConfig(
  overrides: Partial<FeeConfig> = {},
): FeeConfig {
  return useMemo(() => {
    return createFeeConfig(overrides);
  }, [overrides]);
}

/**
 * Hook for multiple fee calculations
 * @param amounts - Array of amounts
 * @param options - Configuration options
 * @returns Array of fee calculation results
 */
export function useMultipleFeeCalculations(
  amounts: number[],
  options: UseFeeCalculatorOptions = {},
): FeeCalculationResult[] {
  const { config = DEFAULT_FEE_CONFIG } = options;

  return useMemo(() => {
    return amounts.map((amount) => calculateTransferFees(amount, config));
  }, [amounts, config]);
}

/**
 * Hook for fee comparison
 * @param amount - Transfer amount
 * @param options - Configuration options
 * @returns Fee comparison data
 */
export function useFeeComparison(
  amount: number,
  options: UseFeeCalculatorOptions = {},
): {
  swiftSendFee: number;
  swiftSendPercentage: number;
  traditionalFee: number;
  traditionalPercentage: number;
  savings: number;
  savingsPercentage: number;
} {
  const { config = DEFAULT_FEE_CONFIG } = options;
  const traditionalPercentage = 0.02; // 2% traditional fee

  return useMemo(() => {
    const swiftSendResult = calculateTransferFees(amount, config);
    const traditionalFee = amount * traditionalPercentage;
    const savings = traditionalFee - swiftSendResult.totalFee;
    const savingsPercentage = (savings / traditionalFee) * 100;

    return {
      swiftSendFee: swiftSendResult.totalFee,
      swiftSendPercentage: swiftSendResult.feePercentage,
      traditionalFee,
      traditionalPercentage: traditionalPercentage * 100,
      savings,
      savingsPercentage,
    };
  }, [amount, config, traditionalPercentage]);
}
