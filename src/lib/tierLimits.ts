import { apiFetch } from '@/services/api';
import { UserTier, TIER_LIMITS, TierLimits } from '@/types';

export interface TransactionLimitResult {
  allowed: boolean;
  reason?: string;
  currentDailyUsage: number;
  currentMonthlyUsage: number;
  dailyLimit: number;
  monthlyLimit: number;
  remainingDaily: number;
  remainingMonthly: number;
}

export interface UsageStats {
  dailyAmount: number;
  monthlyAmount: number;
  dailyCount: number;
  monthlyCount: number;
}

export function getUserTierLimit(tier: UserTier): TierLimits {
  return TIER_LIMITS[tier] ?? TIER_LIMITS.basic;
}

export function checkTransferLimits(
  tier: UserTier,
  amount: number,
  usage: UsageStats
): TransactionLimitResult {
  const limits = getUserTierLimit(tier);

  if (amount > limits.maxTransactionAmount) {
    return {
      allowed: false,
      reason: `Maximum single transaction is ${limits.maxTransactionAmount} for ${tier} tier`,
      currentDailyUsage: usage.dailyAmount,
      currentMonthlyUsage: usage.monthlyAmount,
      dailyLimit: limits.dailyLimit,
      monthlyLimit: limits.monthlyLimit,
      remainingDaily: limits.dailyLimit - usage.dailyAmount,
      remainingMonthly: limits.monthlyLimit - usage.monthlyAmount,
    };
  }

  if (amount < limits.minTransactionAmount) {
    return {
      allowed: false,
      reason: `Minimum single transaction is ${limits.minTransactionAmount} for ${tier} tier`,
      currentDailyUsage: usage.dailyAmount,
      currentMonthlyUsage: usage.monthlyAmount,
      dailyLimit: limits.dailyLimit,
      monthlyLimit: limits.monthlyLimit,
      remainingDaily: limits.dailyLimit - usage.dailyAmount,
      remainingMonthly: limits.monthlyLimit - usage.monthlyAmount,
    };
  }

  if (usage.dailyAmount + amount > limits.dailyLimit) {
    return {
      allowed: false,
      reason: `This transaction would exceed your daily limit of ${limits.dailyLimit}`,
      currentDailyUsage: usage.dailyAmount,
      currentMonthlyUsage: usage.monthlyAmount,
      dailyLimit: limits.dailyLimit,
      monthlyLimit: limits.monthlyLimit,
      remainingDaily: limits.dailyLimit - usage.dailyAmount,
      remainingMonthly: limits.monthlyLimit - usage.monthlyAmount,
    };
  }

  if (usage.monthlyAmount + amount > limits.monthlyLimit) {
    return {
      allowed: false,
      reason: `This transaction would exceed your monthly limit of ${limits.monthlyLimit}`,
      currentDailyUsage: usage.dailyAmount,
      currentMonthlyUsage: usage.monthlyAmount,
      dailyLimit: limits.dailyLimit,
      monthlyLimit: limits.monthlyLimit,
      remainingDaily: limits.dailyLimit - usage.dailyAmount,
      remainingMonthly: limits.monthlyLimit - usage.monthlyAmount,
    };
  }

  if (usage.dailyCount >= limits.maxTransactionsPerDay) {
    return {
      allowed: false,
      reason: `Maximum ${limits.maxTransactionsPerDay} transactions per day reached`,
      currentDailyUsage: usage.dailyAmount,
      currentMonthlyUsage: usage.monthlyAmount,
      dailyLimit: limits.dailyLimit,
      monthlyLimit: limits.monthlyLimit,
      remainingDaily: limits.dailyLimit - usage.dailyAmount,
      remainingMonthly: limits.monthlyLimit - usage.monthlyAmount,
    };
  }

  return {
    allowed: true,
    currentDailyUsage: usage.dailyAmount,
    currentMonthlyUsage: usage.monthlyAmount,
    dailyLimit: limits.dailyLimit,
    monthlyLimit: limits.monthlyLimit,
    remainingDaily: limits.dailyLimit - usage.dailyAmount,
    remainingMonthly: limits.monthlyLimit - usage.monthlyAmount,
  };
}

export async function fetchUsageStats(userId: string): Promise<UsageStats> {
  const response = await apiFetch(`/usage/${userId}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch usage stats');
  }
  
  return response.json() as Promise<UsageStats>;
}

export async function validateTransfer(
  userId: string,
  tier: UserTier,
  amount: number
): Promise<TransactionLimitResult> {
  const usage = await fetchUsageStats(userId);
  return checkTransferLimits(tier, amount, usage);
}