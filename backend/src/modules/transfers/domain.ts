import { ComplianceDecisionResult } from '../compliance/complianceService';
import type { COMPLIANCE_TIERS } from '../compliance/tiers';
import type { FraudAssessment } from '../fraud/fraudService';

export type TransferState =
  | 'created'
  | 'awaiting_multisig'
  | 'validated'
  | 'held'
  | 'submitted'
  | 'settled'
  | 'failed';

export interface TransferRecipient {
  type: 'wallet' | 'cash_pickup' | 'bank';
  walletPublicKey?: string;
  partnerCode?: string;
  country?: string;
  metadata?: Record<string, unknown>;
}

export interface TransferStatusEntry {
  state: TransferState;
  at: string;
  notes?: string;
}

export interface MultiSigApproval {
  approverWalletId: string;
  approvedAt: string;
  signature?: string;
}

export interface MultiSigPolicy {
  threshold: number;
  signers: string[];
  approvals: MultiSigApproval[];
}

export interface TransferRecord {
  id: string;
  clientReference: string;
  userId: string;
  fromWalletId: string;
  recipient: TransferRecipient;
  amount: number;
  currency: string;
  state: TransferState;
  statusHistory: TransferStatusEntry[];
  escrowId?: string;
  compliance: ComplianceDecisionResult;
  fraud?: FraudAssessment;
  multisig?: MultiSigPolicy;
  processingAttempts: number;
  lastError?: string;
  transactionHash?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransferCommand {
  idempotencyKey: string;
  fromWalletId: string;
  recipient: TransferRecipient;
  amount: number;
  currency: string;
  complianceTier?: keyof typeof COMPLIANCE_TIERS;
  userId: string;
  multisig?: {
    threshold: number;
    signers: string[];
    approvals?: Array<{
      approverWalletId: string;
      signature?: string;
    }>;
  };
  metadata?: Record<string, unknown>;
  sourceIp?: string;
}
