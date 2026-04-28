export type ComplianceRiskScore = 'low' | 'medium' | 'high';

export interface ComplianceTier {
  id: string;
  name: string;
  dailyLimit: number;
  monthlyLimit: number;
  yearlyLimit: number;
  singleTransactionLimit: number;
  maxTransactionsPerMinute: number;
  maxTransactionsPerHour: number;
  description: string;
  requirements: string[];
  benefits: string[];
  upgradeRequirements?: string[];
}

export const COMPLIANCE_TIERS: Record<string, ComplianceTier> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    dailyLimit: 500,
    monthlyLimit: 2000,
    yearlyLimit: 10000,
    singleTransactionLimit: 250,
    maxTransactionsPerMinute: 1,
    maxTransactionsPerHour: 3,
    description: 'Perfect for getting started with small transfers',
    requirements: ['Valid email or phone', 'Basic profile information'],
    benefits: ['Instant transfers up to $250', 'Access to all destination countries', 'Real-time tracking', 'Customer support'],
    upgradeRequirements: ['Government ID verification', 'Proof of address'],
  },
  verified: {
    id: 'verified',
    name: 'Verified',
    dailyLimit: 2500,
    monthlyLimit: 10000,
    yearlyLimit: 50000,
    singleTransactionLimit: 1000,
    maxTransactionsPerMinute: 2,
    maxTransactionsPerHour: 8,
    description: 'Increased limits with identity verification',
    requirements: ['Government-issued photo ID', 'Proof of address', 'Phone number verification'],
    benefits: ['Transfer up to $1,000 per transaction', 'Higher monthly limits', 'Priority customer support', 'Access to business features'],
    upgradeRequirements: ['Enhanced due diligence', 'Source of funds documentation'],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    dailyLimit: 10000,
    monthlyLimit: 50000,
    yearlyLimit: 250000,
    singleTransactionLimit: 5000,
    maxTransactionsPerMinute: 5,
    maxTransactionsPerHour: 20,
    description: 'Maximum limits for frequent users and businesses',
    requirements: ['Enhanced identity verification', 'Source of funds documentation', 'Regular activity review'],
    benefits: ['Transfer up to $5,000 per transaction', 'Highest available limits', 'Dedicated account manager', 'Custom compliance solutions', 'Reduced fees for high volume'],
  },
};
