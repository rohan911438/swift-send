import type { TransferState } from './domain';
import type { FraudAssessment } from '../fraud/fraudService';

export const TransferEventType = {
  Created: 'transfer.created',
  StateChanged: 'transfer.state_changed',
  Settled: 'transfer.settled',
  Failed: 'transfer.failed',
  Flagged: 'transfer.flagged',
  QueueCompleted: 'queue.transfer_completed',
  QueueFailed: 'queue.transfer_failed',
} as const;

export type TransferEventType =
  (typeof TransferEventType)[keyof typeof TransferEventType];

export interface TransferCreatedEventPayload {
  userId: string;
  transferId: string;
  amount: number;
  currency: string;
  recipientName: string;
}

export interface TransferStateChangedEventPayload {
  userId: string;
  transferId: string;
  amount: number;
  currency: string;
  recipientName: string;
  previousState: TransferState;
  state: TransferState;
  notes?: string;
}

export interface TransferSettledEventPayload {
  userId: string;
  transferId: string;
  amount: number;
  currency: string;
  recipientName: string;
}

export interface TransferFailedEventPayload {
  userId: string;
  transferId: string;
  amount: number;
  currency: string;
  recipientName: string;
  error?: string;
}

export interface TransferFlaggedEventPayload {
  userId: string;
  transferId: string;
  assessment: FraudAssessment;
  amount: number;
  currency: string;
  recipientName: string;
}

export interface QueueTransferCompletedEventPayload {
  jobId: string;
  transferId: string;
}

export interface QueueTransferFailedEventPayload {
  jobId: string;
  transferId: string;
  error?: string;
}
