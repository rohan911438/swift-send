export type UserTier = 'starter' | 'verified' | 'premium';

export interface ComplianceResult {
  allowed: boolean;
  requiresEnhancedVerification: boolean;
  reason?: string;
  warnings: string[];
  suggestedTier?: UserTier;
}

export interface TransactionRisk {
  score: number; // 0-100
  level: 'low' | 'medium' | 'high';
  factors: string[];
}

export interface UserComplianceData {
  id: string;
  tier: UserTier;
  monthlySpent: number;
  dailySpent: number;
  yearlySpent: number;
}

// Tier limits configuration
const TIER_LIMITS = {
  starter: {
    singleTransaction: 1000,
    daily: 2000,
    monthly: 5000,
    yearly: 25000,
  },
  verified: {
    singleTransaction: 10000,
    daily: 5000,
    monthly: 25000,
    yearly: 100000,
  },
  premium: {
    singleTransaction: 50000,
    daily: 25000,
    monthly: 100000,
    yearly: 500000,
  },
};

// High-risk countries (simplified list)
const HIGH_RISK_COUNTRIES = new Set([
  'AF', 'BY', 'CF', 'CU', 'CD', 'ER', 'GN', 'GW', 'HT', 'IR', 
  'IQ', 'KP', 'LB', 'LY', 'ML', 'MM', 'NI', 'SO', 'SS', 'SD', 
  'SY', 'VE', 'YE', 'ZW'
]);

/**
 * Check if a transfer is allowed based on compliance limits
 */
export function checkComplianceLimits(
  user: UserComplianceData,
  amount: number,
  destinationCountry: string
): ComplianceResult {
  const result: ComplianceResult = {
    allowed: true,
    requiresEnhancedVerification: false,
    warnings: [],
  };

  // Validate amount
  if (amount <= 0) {
    return {
      allowed: false,
      requiresEnhancedVerification: false,
      reason: 'Invalid amount: must be greater than 0',
      warnings: [],
    };
  }

  const limits = TIER_LIMITS[user.tier];

  // Check single transaction limit
  if (amount > limits.singleTransaction) {
    return {
      allowed: false,
      requiresEnhancedVerification: false,
      reason: `Amount exceeds single transaction limit of $${limits.singleTransaction.toLocaleString()}`,
      warnings: [],
      suggestedTier: getNextTier(user.tier),
    };
  }

  // Check daily limit
  if (user.dailySpent + amount > limits.daily) {
    return {
      allowed: false,
      requiresEnhancedVerification: false,
      reason: `Transfer would exceed daily limit of $${limits.daily.toLocaleString()}`,
      warnings: [],
      suggestedTier: getNextTier(user.tier),
    };
  }

  // Check monthly limit
  if (user.monthlySpent + amount > limits.monthly) {
    return {
      allowed: false,
      requiresEnhancedVerification: false,
      reason: `Transfer would exceed monthly limit of $${limits.monthly.toLocaleString()}`,
      warnings: [],
      suggestedTier: getNextTier(user.tier),
    };
  }

  // Check yearly limit
  if (user.yearlySpent + amount > limits.yearly) {
    return {
      allowed: false,
      requiresEnhancedVerification: false,
      reason: `Transfer would exceed yearly limit of $${limits.yearly.toLocaleString()}`,
      warnings: [],
      suggestedTier: getNextTier(user.tier),
    };
  }

  // Warning thresholds (80% of limits)
  const warningThreshold = 0.8;

  if (user.monthlySpent + amount > limits.monthly * warningThreshold) {
    result.warnings.push(`You are approaching your monthly limit of $${limits.monthly.toLocaleString()}`);
  }

  if (user.dailySpent + amount > limits.daily * warningThreshold) {
    result.warnings.push(`You are approaching your daily limit of $${limits.daily.toLocaleString()}`);
  }

  // Enhanced verification for high-risk countries
  if (HIGH_RISK_COUNTRIES.has(destinationCountry) || destinationCountry === 'XX') {
    result.requiresEnhancedVerification = true;
    result.warnings.push('Enhanced verification required for this destination');
  }

  // Enhanced verification for large amounts (even within limits)
  if (amount > limits.singleTransaction * 0.5) {
    result.requiresEnhancedVerification = true;
  }

  return result;
}

/**
 * Calculate risk score for a transaction
 */
export function calculateRiskScore(
  amount: number,
  destinationCountry: string,
  dailyTransactionCount: number,
  dailySpentAmount: number
): TransactionRisk {
  let score = 0;
  const factors: string[] = [];

  // Amount-based risk
  if (amount < 100) {
    score += 5;
    factors.push('Small transaction amount');
  } else if (amount < 1000) {
    score += 10;
    factors.push('Normal transaction amount');
  } else if (amount < 5000) {
    score += 25;
    factors.push('Moderate transaction amount');
  } else {
    score += 40;
    factors.push('Large transaction amount');
  }

  // Country-based risk
  if (HIGH_RISK_COUNTRIES.has(destinationCountry)) {
    score += 30;
    factors.push('High-risk destination country');
  } else if (destinationCountry === 'XX') {
    score += 20;
    factors.push('Unknown destination country');
  } else {
    score += 5;
    factors.push('Low-risk destination country');
  }

  // Frequency-based risk
  if (dailyTransactionCount > 5) {
    score += 20;
    factors.push('High transaction frequency');
  } else if (dailyTransactionCount > 2) {
    score += 10;
    factors.push('Moderate transaction frequency');
  } else {
    score += 5;
    factors.push('Low transaction frequency');
  }

  // Velocity-based risk
  if (dailySpentAmount > 5000) {
    score += 25;
    factors.push('High spending velocity');
  } else if (dailySpentAmount > 1000) {
    score += 10;
    factors.push('Moderate spending velocity');
  } else {
    score += 5;
    factors.push('Low spending velocity');
  }

  // Determine risk level
  let level: 'low' | 'medium' | 'high';
  if (score < 30) {
    level = 'low';
  } else if (score < 70) {
    level = 'medium';
  } else {
    level = 'high';
  }

  return {
    score: Math.min(score, 100),
    level,
    factors,
  };
}

function getNextTier(currentTier: UserTier): UserTier | undefined {
  switch (currentTier) {
    case 'starter':
      return 'verified';
    case 'verified':
      return 'premium';
    case 'premium':
      return undefined; // Already at highest tier
  }
}