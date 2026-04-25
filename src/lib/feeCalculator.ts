/**
 * Comprehensive fee calculation module
 * Handles all fee calculations with support for different transaction types,
 * currencies, and edge cases
 */

export interface FeeConfig {
  networkFeeFixed: number; // Fixed network fee in USDC
  serviceFeePercentage: number; // Service fee as percentage (0.2 = 0.2%)
  minServiceFee: number; // Minimum service fee
  maxServiceFee: number; // Maximum service fee
  exchangeFeePercentage?: number; // Exchange fee for currency conversion
  minExchangeFee?: number;
  maxExchangeFee?: number;
}

export interface FeeCalculationResult {
  amount: number;
  networkFee: number;
  serviceFee: number;
  exchangeFee: number;
  totalFee: number;
  recipientGets: number;
  feePercentage: number; // Total fee as percentage of amount
}

export interface DetailedFeeBreakdown extends FeeCalculationResult {
  breakdown: {
    networkFee: {
      amount: number;
      description: string;
    };
    serviceFee: {
      amount: number;
      percentage: number;
      description: string;
    };
    exchangeFee?: {
      amount: number;
      percentage: number;
      description: string;
    };
  };
}

/**
 * Default fee configuration
 * Optimized for remittance use case
 */
export const DEFAULT_FEE_CONFIG: FeeConfig = {
  networkFeeFixed: 0.001, // Stellar network fee (near zero)
  serviceFeePercentage: 0.002, // 0.2% service fee
  minServiceFee: 0.01, // Minimum $0.01
  maxServiceFee: 50.0, // Maximum $50
  exchangeFeePercentage: 0.01, // 1% for currency conversion
  minExchangeFee: 0.0,
  maxExchangeFee: 100.0,
};

/**
 * Calculate fees for a transfer
 * @param amount - Transfer amount in USDC
 * @param config - Fee configuration (uses default if not provided)
 * @returns Fee calculation result
 */
export function calculateTransferFees(
  amount: number,
  config: FeeConfig = DEFAULT_FEE_CONFIG,
): FeeCalculationResult {
  // Validate input
  if (!isValidAmount(amount)) {
    throw new Error("Invalid transfer amount");
  }

  // Calculate individual fees
  const networkFee = calculateNetworkFee(amount, config);
  const serviceFee = calculateServiceFee(amount, config);
  const exchangeFee = 0; // No exchange fee for USDC to USDC transfers

  // Calculate totals
  const totalFee = roundToTwoDecimals(networkFee + serviceFee + exchangeFee);
  const recipientGets = roundToTwoDecimals(amount - totalFee);
  const feePercentage =
    amount > 0 ? roundToTwoDecimals((totalFee / amount) * 100) : 0;

  return {
    amount: roundToTwoDecimals(amount),
    networkFee: roundToTwoDecimals(networkFee),
    serviceFee: roundToTwoDecimals(serviceFee),
    exchangeFee: roundToTwoDecimals(exchangeFee),
    totalFee,
    recipientGets,
    feePercentage,
  };
}

/**
 * Calculate fees with detailed breakdown
 * @param amount - Transfer amount in USDC
 * @param config - Fee configuration
 * @returns Detailed fee breakdown
 */
export function calculateTransferFeesDetailed(
  amount: number,
  config: FeeConfig = DEFAULT_FEE_CONFIG,
): DetailedFeeBreakdown {
  const result = calculateTransferFees(amount, config);

  return {
    ...result,
    breakdown: {
      networkFee: {
        amount: result.networkFee,
        description: "Stellar network fee",
      },
      serviceFee: {
        amount: result.serviceFee,
        percentage:
          amount > 0
            ? roundToTwoDecimals((result.serviceFee / amount) * 100)
            : 0,
        description: "SwiftSend service fee",
      },
      exchangeFee:
        result.exchangeFee > 0
          ? {
              amount: result.exchangeFee,
              percentage:
                amount > 0
                  ? roundToTwoDecimals((result.exchangeFee / amount) * 100)
                  : 0,
              description: "Currency exchange fee",
            }
          : undefined,
    },
  };
}

/**
 * Calculate fees for a transfer with currency conversion
 * @param amount - Transfer amount in source currency
 * @param exchangeRate - Exchange rate from source to USDC
 * @param config - Fee configuration
 * @returns Fee calculation result
 */
export function calculateTransferFeesWithExchange(
  amount: number,
  exchangeRate: number,
  config: FeeConfig = DEFAULT_FEE_CONFIG,
): FeeCalculationResult {
  // Validate inputs
  if (!isValidAmount(amount)) {
    throw new Error("Invalid transfer amount");
  }
  if (!isValidExchangeRate(exchangeRate)) {
    throw new Error("Invalid exchange rate");
  }

  // Convert to USDC
  const amountInUSDC = roundToTwoDecimals(amount / exchangeRate);

  // Calculate fees in USDC
  const networkFee = calculateNetworkFee(amountInUSDC, config);
  const serviceFee = calculateServiceFee(amountInUSDC, config);
  const exchangeFee = calculateExchangeFee(amountInUSDC, config);

  // Calculate totals
  const totalFee = roundToTwoDecimals(networkFee + serviceFee + exchangeFee);
  const recipientGets = roundToTwoDecimals(amountInUSDC - totalFee);
  const feePercentage =
    amountInUSDC > 0 ? roundToTwoDecimals((totalFee / amountInUSDC) * 100) : 0;

  return {
    amount: roundToTwoDecimals(amountInUSDC),
    networkFee: networkFee,
    serviceFee: roundToTwoDecimals(serviceFee),
    exchangeFee: roundToTwoDecimals(exchangeFee),
    totalFee,
    recipientGets,
    feePercentage,
  };
}

/**
 * Calculate network fee
 * @param amount - Transfer amount
 * @param config - Fee configuration
 * @returns Network fee
 */
function calculateNetworkFee(amount: number, config: FeeConfig): number {
  // Network fee is fixed regardless of amount
  return config.networkFeeFixed;
}

/**
 * Calculate service fee
 * @param amount - Transfer amount
 * @param config - Fee configuration
 * @returns Service fee
 */
function calculateServiceFee(amount: number, config: FeeConfig): number {
  // Calculate percentage-based fee
  let fee = amount * config.serviceFeePercentage;

  // Apply minimum fee
  if (fee < config.minServiceFee) {
    fee = config.minServiceFee;
  }

  // Apply maximum fee
  if (fee > config.maxServiceFee) {
    fee = config.maxServiceFee;
  }

  return fee;
}

/**
 * Calculate exchange fee
 * @param amount - Transfer amount in USDC
 * @param config - Fee configuration
 * @returns Exchange fee
 */
function calculateExchangeFee(amount: number, config: FeeConfig): number {
  if (!config.exchangeFeePercentage) {
    return 0;
  }

  // Calculate percentage-based fee
  let fee = amount * config.exchangeFeePercentage;

  // Apply minimum fee
  if (config.minExchangeFee && fee < config.minExchangeFee) {
    fee = config.minExchangeFee;
  }

  // Apply maximum fee
  if (config.maxExchangeFee && fee > config.maxExchangeFee) {
    fee = config.maxExchangeFee;
  }

  return fee;
}

/**
 * Calculate recipient amount (reverse calculation)
 * @param recipientAmount - Amount recipient should receive
 * @param config - Fee configuration
 * @returns Sender amount needed
 */
export function calculateSenderAmountFromRecipientAmount(
  recipientAmount: number,
  config: FeeConfig = DEFAULT_FEE_CONFIG,
): FeeCalculationResult {
  // Validate input
  if (!isValidAmount(recipientAmount)) {
    throw new Error("Invalid recipient amount");
  }

  // Estimate sender amount (iterative approach for accuracy)
  let senderAmount = recipientAmount;
  let previousAmount = 0;
  let iterations = 0;
  const maxIterations = 10;

  while (
    Math.abs(senderAmount - previousAmount) > 0.01 &&
    iterations < maxIterations
  ) {
    previousAmount = senderAmount;
    const fees = calculateTransferFees(senderAmount, config);
    senderAmount = roundToTwoDecimals(recipientAmount + fees.totalFee);
    iterations++;
  }

  return calculateTransferFees(senderAmount, config);
}

/**
 * Validate transfer amount
 * @param amount - Amount to validate
 * @returns True if valid
 */
export function isValidAmount(amount: unknown): boolean {
  if (typeof amount !== "number") {
    return false;
  }

  if (!Number.isFinite(amount)) {
    return false;
  }

  if (amount <= 0) {
    return false;
  }

  // Check for reasonable limits
  if (amount > 1000000) {
    return false; // Max $1M per transaction
  }

  return true;
}

/**
 * Validate exchange rate
 * @param rate - Exchange rate to validate
 * @returns True if valid
 */
export function isValidExchangeRate(rate: unknown): boolean {
  if (typeof rate !== "number") {
    return false;
  }

  if (!Number.isFinite(rate)) {
    return false;
  }

  if (rate <= 0) {
    return false;
  }

  // Check for reasonable limits (1:1 to 1:1000000)
  if (rate > 1000000 || rate < 0.000001) {
    return false;
  }

  return true;
}

/**
 * Round to two decimal places
 * @param value - Value to round
 * @returns Rounded value
 */
export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Format fee as currency string
 * @param amount - Amount to format
 * @param currency - Currency code (default: USD)
 * @returns Formatted string
 */
export function formatFeeAsCurrency(
  amount: number,
  currency: string = "USD",
): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });

  return formatter.format(amount);
}

/**
 * Get fee tier based on amount
 * @param amount - Transfer amount
 * @returns Fee tier name
 */
export function getFeeTier(amount: number): string {
  if (amount < 10) return "micro";
  if (amount < 100) return "small";
  if (amount < 1000) return "medium";
  if (amount < 10000) return "large";
  return "enterprise";
}

/**
 * Calculate savings compared to traditional wire transfer
 * @param amount - Transfer amount
 * @param traditionalFeePercentage - Traditional fee percentage (default: 2%)
 * @param config - Fee configuration
 * @returns Savings amount
 */
export function calculateSavingsVsTraditional(
  amount: number,
  traditionalFeePercentage: number = 0.02,
  config: FeeConfig = DEFAULT_FEE_CONFIG,
): number {
  const swiftSendFees = calculateTransferFees(amount, config);
  const traditionalFee = amount * traditionalFeePercentage;

  return roundToTwoDecimals(traditionalFee - swiftSendFees.totalFee);
}

/**
 * Get fee statistics for a list of amounts
 * @param amounts - Array of amounts
 * @param config - Fee configuration
 * @returns Fee statistics
 */
export function getFeeStatistics(
  amounts: number[],
  config: FeeConfig = DEFAULT_FEE_CONFIG,
): {
  averageFeePercentage: number;
  minFeePercentage: number;
  maxFeePercentage: number;
  totalFees: number;
  averageFee: number;
} {
  if (amounts.length === 0) {
    return {
      averageFeePercentage: 0,
      minFeePercentage: 0,
      maxFeePercentage: 0,
      totalFees: 0,
      averageFee: 0,
    };
  }

  const results = amounts.map((amount) =>
    calculateTransferFees(amount, config),
  );
  const totalFees = results.reduce((sum, r) => sum + r.totalFee, 0);
  const averageFee = roundToTwoDecimals(totalFees / amounts.length);
  const feePercentages = results.map((r) => r.feePercentage);

  return {
    averageFeePercentage: roundToTwoDecimals(
      feePercentages.reduce((sum, p) => sum + p, 0) / feePercentages.length,
    ),
    minFeePercentage: Math.min(...feePercentages),
    maxFeePercentage: Math.max(...feePercentages),
    totalFees: roundToTwoDecimals(totalFees),
    averageFee,
  };
}

/**
 * Create custom fee configuration
 * @param overrides - Partial fee configuration to override defaults
 * @returns Complete fee configuration
 */
export function createFeeConfig(overrides: Partial<FeeConfig> = {}): FeeConfig {
  return {
    ...DEFAULT_FEE_CONFIG,
    ...overrides,
  };
}
