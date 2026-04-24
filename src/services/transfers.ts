import { apiFetch } from '@/lib/api';

type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike };

export interface TransferCreatePayload {
  idempotency_key: string;
  from_wallet_id: string;
  user_id: string;
  amount: number;
  currency: string;
  recipient: {
    type: 'wallet' | 'cash_pickup' | 'bank';
    wallet_public_key?: string;
    partner_code?: string;
    country?: string;
    metadata?: Record<string, unknown>;
  };
  compliance_tier?: string;
  metadata?: Record<string, unknown>;
}

export interface TransferCreateResponse {
  id: string;
  status: string;
  available_balance?: number | null;
}

export interface QueuedTransferResponse {
  queue_job_id: string;
  transfer_initiated: boolean;
  status_url: string;
}

export interface QueueJobStatus {
  queue_job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

function sortValue(value: JsonLike): JsonLike {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, JsonLike>>((accumulator, key) => {
        const nestedValue = (value as Record<string, JsonLike>)[key];
        if (nestedValue !== undefined) {
          accumulator[key] = sortValue(nestedValue);
        }
        return accumulator;
      }, {});
  }

  return value;
}

export function canonicalizeTransferPayload(payload: TransferCreatePayload): string {
  return JSON.stringify(sortValue(payload as any));
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signatureBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function createTransfer(payload: TransferCreatePayload, transactionSigningSecret: string): Promise<QueuedTransferResponse> {
  const signature = await signPayload(canonicalizeTransferPayload(payload), transactionSigningSecret);
  const response = await apiFetch('/transfers', {
    method: 'POST',
    body: JSON.stringify({ ...payload, signature }),
  });

  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(body.error || 'Transfer failed');
  }

  return body as QueuedTransferResponse;
}

export async function checkTransferQueueStatus(jobId: string): Promise<QueueJobStatus> {
  const response = await apiFetch(`/transfers/${jobId}/status`);
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(body.error || 'Failed to check transfer status');
  }

  return body as QueueJobStatus;
}