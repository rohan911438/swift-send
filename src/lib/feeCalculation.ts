export interface FeeCalculation {
  networkFee: number;
  serviceFee: number;
  totalFee: number;
  recipientGets: number;
}

const STELLAR_NETWORK_FEE = 0.00001; // Fixed Stellar network fee in XLM/USDC
const SERVICE_FEE_RATE = 0.005; // 0.5%
const MIN_SERVICE_FEE = 0.01; // $0.01 minimum
const MAX_SERVICE_FEE = 25.00; // $25.00 maximum

/**
 * Calculate fees for a transfer amount
 * @param amount - The transfer amount in USD
 * @returns Fee breakdown with network fee, service fee, total fee, and recipient amount
 */
export function calculateFees(amount: number): FeeCalculation {
  const networkFee = STELLAR_NETWORK_FEE;
  
  // Calculate service fee with min/max bounds
  let serviceFee = Math.max(amount * SERVICE_FEE_RATE, MIN_SERVICE_FEE);
  serviceFee = Math.min(serviceFee, MAX_SERVICE_FEE);
  
  const totalFee = networkFee + serviceFee;
  const recipientGets = amount - totalFee;

  return {
    networkFee,
    serviceFee,
    totalFee,
    recipientGets,
  };
}

/**
 * Calculate savings compared to traditional wire transfer
 * @param amount - The transfer amount in USD
 * @returns Savings amount and percentage
 */
export function calculateSavings(amount: number): { amount: number; percentage: number } {
  const traditionalFee = Math.max(amount * 0.03, 15); // 3% or $15 minimum
  const ourFees = calculateFees(amount);
  const savings = traditionalFee - ourFees.totalFee;
  const percentage = (savings / traditionalFee) * 100;

  return {
    amount: Math.max(savings, 0),
    percentage: Math.max(percentage, 0),
  };
}