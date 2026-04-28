import { apiFetch } from "@/lib/api";

type JsonLike =
  | null
  | boolean
  | number
  | string
  | JsonLike[]
  | { [key: string]: JsonLike };

export interface TransferCreatePayload {
  idempotency_key: string;
  from_wallet_id: string;
  user_id: string;
  amount: number;
  currency: string;
  recipient: {
    type: "wallet" | "cash_pickup" | "bank";
    wallet_public_key?: string;
    partner_code?: string;
    country?: string;
    metadata?: Record<string, unknown>;
  };
  compliance_tier?: string;
  multisig?: {
    enabled?: boolean;
    threshold?: number;
    signers?: string[];
    approvals?: Array<{
      approver_wallet_id: string;
      signature?: string;
    }>;
  };
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
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface TransferFeeEstimate {
  amount: number;
  network_fee: number;
  service_fee: number;
  total_fee: number;
  recipient_gets: number;
  fee_percentage: number;
  optimization?: {
    queue_length: number;
    load_multiplier: number;
    optimized: boolean;
  };
}

export interface TransferSimulationResult {
  executable: boolean;
  expected_status: 'awaiting_multisig' | 'submitted';
  fees: {
    network_fee: number;
    service_fee: number;
    total_fee: number;
  };
  recipient_gets: number;
  warnings: string[];
  compliance: {
    tier: string;
    can_proceed: boolean;
  };
  multisig?: {
    threshold: number;
    signers: string[];
    approvals_count: number;
    approvals_required: number;
  };
}

function sortValue(value: JsonLike): JsonLike {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (value && typeof value === "object") {
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
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );
  return Array.from(new Uint8Array(signatureBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createTransfer(
  payload: TransferCreatePayload,
  transactionSigningSecret: string,
): Promise<QueuedTransferResponse> {
  const signature = await signPayload(
    canonicalizeTransferPayload(payload),
    transactionSigningSecret,
  );
  const response = await apiFetch("/transfers", {
    method: "POST",
    body: JSON.stringify({ ...payload, signature }),
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    const errorBody = body as { error?: string; details?: unknown };
    const errorMessage = errorBody.error || "Transfer failed";
    const error = new Error(errorMessage);
    (error as any).details = errorBody.details;
    (error as any).statusCode = response.status;
    throw error;
  }

  return body as QueuedTransferResponse;
}

export async function checkTransferQueueStatus(
  jobId: string,
): Promise<QueueJobStatus> {
  const response = await apiFetch(`/transfers/${jobId}/status`);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    const errorBody = body as { error?: string };
    throw new Error(errorBody.error || "Failed to check transfer status");
  }

  return body as QueueJobStatus;
}

export async function simulateTransfer(
  payload: TransferCreatePayload,
): Promise<TransferSimulationResult> {
  const response = await apiFetch('/transfers/simulate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    const errorBody = body as { error?: string };
    throw new Error(errorBody.error || 'Failed to simulate transfer');
  }

  return body as TransferSimulationResult;
}

export async function fetchTransferFeeEstimate(amount: number): Promise<TransferFeeEstimate> {
  const response = await apiFetch(`/transfers/fee-estimate?amount=${amount}`);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    const errorBody = body as { error?: string };
    throw new Error(errorBody.error || 'Failed to fetch fee estimate');
  }

  return body as TransferFeeEstimate;
}
