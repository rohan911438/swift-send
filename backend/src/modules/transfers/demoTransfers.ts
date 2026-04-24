import type { ComplianceDecisionResult } from '../compliance/complianceService';
import type { FraudAssessment } from '../fraud/fraudService';
import type { TransferRecord, TransferStatusEntry } from './domain';

export function createDemoTransfers(): TransferRecord[] {
  const now = Date.now();

  return [
    buildTransfer({
      id: 'demo_transfer_mx_001',
      amount: 200,
      currency: 'USDC',
      createdAt: new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 90 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
      state: 'settled',
      recipient: {
        type: 'cash_pickup',
        country: 'MX',
        partnerCode: 'OXXO',
        metadata: {
          identifier: '+52 55 1234 5678',
          name: 'Juan Garcia',
          destination_currency: 'MXN',
        },
      },
      metadata: {
        network_fee: 0.001,
        service_fee: 0.4,
      },
      compliance: buildComplianceDecision('starter', 'low'),
      fraud: buildFraudAssessment(18, 'low'),
      statusHistory: buildStatusHistory(new Date(now - 90 * 24 * 60 * 60 * 1000), 'settled'),
    }),
    buildTransfer({
      id: 'demo_transfer_sv_002',
      amount: 320,
      currency: 'USDC',
      createdAt: new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 45 * 24 * 60 * 60 * 1000 + 8 * 60 * 1000).toISOString(),
      state: 'settled',
      recipient: {
        type: 'bank',
        country: 'SV',
        partnerCode: 'BANCO_AGRICOLA',
        metadata: {
          identifier: '+503 7890 1234',
          name: 'Ana Lopez',
          destination_currency: 'USD',
        },
      },
      metadata: {
        network_fee: 0.001,
        service_fee: 0.64,
      },
      compliance: buildComplianceDecision('verified', 'low'),
      fraud: buildFraudAssessment(22, 'low'),
      statusHistory: buildStatusHistory(new Date(now - 45 * 24 * 60 * 60 * 1000), 'settled'),
    }),
    buildTransfer({
      id: 'demo_transfer_ph_003',
      amount: 500,
      currency: 'USDC',
      createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 2 * 24 * 60 * 60 * 1000 + 12 * 60 * 1000).toISOString(),
      state: 'settled',
      recipient: {
        type: 'bank',
        country: 'PH',
        partnerCode: 'UNIONBANK',
        metadata: {
          identifier: '+63 917 123 4567',
          name: 'Rosa Martinez',
          destination_currency: 'PHP',
        },
      },
      metadata: {
        network_fee: 0.001,
        service_fee: 1,
      },
      compliance: buildComplianceDecision('verified', 'medium', ['Approaching monthly limit']),
      fraud: buildFraudAssessment(46, 'medium', [
        { code: 'large_amount', label: 'Large transfer amount', severity: 'medium' },
      ]),
      statusHistory: buildStatusHistory(new Date(now - 2 * 24 * 60 * 60 * 1000), 'settled'),
    }),
    buildTransfer({
      id: 'demo_transfer_gt_004',
      amount: 150,
      currency: 'USDC',
      createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 3 * 60 * 1000).toISOString(),
      state: 'held',
      recipient: {
        type: 'cash_pickup',
        country: 'GT',
        partnerCode: 'GUATEMALA_EXPRESS',
        metadata: {
          identifier: '+502 5555 1234',
          name: 'Carlos Reyes',
          destination_currency: 'GTQ',
        },
      },
      metadata: {
        network_fee: 0.001,
        service_fee: 0.3,
      },
      compliance: buildComplianceDecision('starter', 'low'),
      fraud: buildFraudAssessment(24, 'low'),
      statusHistory: buildStatusHistory(new Date(now - 5 * 60 * 1000), 'held'),
    }),
    buildTransfer({
      id: 'demo_transfer_review_005',
      amount: 780,
      currency: 'USDC',
      createdAt: new Date(now - 26 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 25 * 60 * 60 * 1000).toISOString(),
      state: 'failed',
      recipient: {
        type: 'bank',
        country: 'RU',
        partnerCode: 'MANUAL_REVIEW',
        metadata: {
          identifier: '+7 900 555 0101',
          name: 'Security Review',
          destination_currency: 'RUB',
        },
      },
      metadata: {
        network_fee: 0.001,
        service_fee: 1.56,
      },
      compliance: buildComplianceDecision('starter', 'high', ['High risk routing — manual review recommended']),
      fraud: buildFraudAssessment(82, 'high', [
        { code: 'high_risk_destination', label: 'High-risk destination corridor', severity: 'high' },
        { code: 'rapid_repeat', label: 'Multiple transfers in 24 hours', severity: 'medium' },
      ], true, new Date(now - 25 * 60 * 60 * 1000).toISOString()),
      statusHistory: buildStatusHistory(new Date(now - 26 * 60 * 60 * 1000), 'failed', 'Flagged and refunded after review'),
      lastError: 'Transfer paused for compliance review and automatically refunded.',
    }),
  ];
}

function buildTransfer(input: {
  id: string;
  amount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  state: TransferRecord['state'];
  recipient: TransferRecord['recipient'];
  metadata: Record<string, unknown>;
  compliance: ComplianceDecisionResult;
  fraud?: FraudAssessment;
  statusHistory: TransferStatusEntry[];
  lastError?: string;
}): TransferRecord {
  return {
    id: input.id,
    clientReference: input.id,
    userId: '1',
    fromWalletId: 'wallet_maria_santos_123',
    recipient: input.recipient,
    amount: input.amount,
    currency: input.currency,
    state: input.state,
    statusHistory: input.statusHistory,
    escrowId: `escrow_${input.id}`,
    compliance: input.compliance,
    fraud: input.fraud,
    processingAttempts: input.state === 'failed' ? 3 : 1,
    lastError: input.lastError,
    metadata: input.metadata,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

function buildStatusHistory(startedAt: Date, finalState: TransferRecord['state'], finalNotes?: string): TransferStatusEntry[] {
  const base = startedAt.getTime();
  const history: TransferStatusEntry[] = [
    { state: 'created', at: new Date(base).toISOString() },
    { state: 'validated', at: new Date(base + 60 * 1000).toISOString() },
    { state: 'held', at: new Date(base + 2 * 60 * 1000).toISOString() },
  ];

  if (finalState !== 'held') {
    history.push({
      state: finalState,
      at: new Date(base + 5 * 60 * 1000).toISOString(),
      notes: finalNotes,
    });
  }

  return history;
}

function buildComplianceDecision(
  tierId: string,
  riskScore: 'low' | 'medium' | 'high',
  warnings: string[] = [],
): ComplianceDecisionResult {
  return {
    canProceed: true,
    blockers: [],
    warnings,
    riskScore,
    tier: {
      id: tierId,
      name: tierId === 'starter' ? 'Starter' : tierId === 'verified' ? 'Verified' : 'Premium',
      dailyLimit: tierId === 'starter' ? 500 : tierId === 'verified' ? 2500 : 10000,
      monthlyLimit: tierId === 'starter' ? 2000 : tierId === 'verified' ? 10000 : 50000,
      yearlyLimit: tierId === 'starter' ? 10000 : tierId === 'verified' ? 50000 : 250000,
      singleTransactionLimit: tierId === 'starter' ? 250 : tierId === 'verified' ? 1000 : 5000,
      description: 'Seeded demo tier',
      requirements: [],
      benefits: [],
    },
    nextTier: tierId === 'starter'
      ? {
          id: 'verified',
          name: 'Verified',
          dailyLimit: 2500,
          monthlyLimit: 10000,
          yearlyLimit: 50000,
          singleTransactionLimit: 1000,
          description: 'Seeded next tier',
          requirements: [],
          benefits: [],
        }
      : undefined,
  };
}

function buildFraudAssessment(
  score: number,
  level: 'low' | 'medium' | 'high',
  flags: FraudAssessment['flags'] = [],
  requiresReview = false,
  loggedAt?: string,
): FraudAssessment {
  return {
    score,
    level,
    flags,
    requiresReview,
    loggedAt,
  };
}
