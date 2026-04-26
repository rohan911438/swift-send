import { apiFetch } from '@/services/api';

export const DEFAULT_CANCELLATION_WINDOW_SECONDS = 300; // 5 minutes
export const MAX_CANCELLATION_WINDOW_SECONDS = 600; // 10 minutes

export interface CancelTransactionRequest {
  transfer_id: string;
  reason?: string;
}

export interface CancelTransactionResponse {
  success: boolean;
  transfer_id: string;
  status: 'cancelled';
  refunded: boolean;
  refund_amount: number;
  message: string;
}

export async function cancelTransaction(
  request: CancelTransactionRequest
): Promise<CancelTransactionResponse> {
  const response = await apiFetch('/transfers/cancel', {
    method: 'POST',
    body: JSON.stringify(request),
  });

  const body = await response.json() as CancelTransactionResponse;

  if (!response.ok) {
    const error = new Error(body.message || 'Failed to cancel transaction');
    throw error;
  }

  return body;
}

export function canCancelTransaction(
  createdAt: Date,
  windowSeconds: number = DEFAULT_CANCELLATION_WINDOW_SECONDS
): boolean {
  const now = new Date();
  const elapsedSeconds = (now.getTime() - createdAt.getTime()) / 1000;
  return elapsedSeconds < windowSeconds;
}

export function getRemainingCancelTime(
  createdAt: Date,
  windowSeconds: number = DEFAULT_CANCELLATION_WINDOW_SECONDS
): number {
  const now = new Date();
  const elapsedSeconds = (now.getTime() - createdAt.getTime()) / 1000;
  const remaining = windowSeconds - elapsedSeconds;
  return Math.max(0, Math.ceil(remaining));
}