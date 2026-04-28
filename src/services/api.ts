import { transferLogger } from '@/lib/transferLogger';

/** Base URL for the API. When unset, `/api/*` is proxied to the backend in dev (see `vite.config.ts`). */
export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const base = import.meta.env.VITE_API_URL as string | undefined;
  if (base?.length) {
    return `${base.replace(/\/$/, '')}${normalized}`;
  }
  return `/api${normalized}`;
}

type CircuitState = 'closed' | 'open' | 'half-open';

interface ApiCircuit {
  state: CircuitState;
  openedAt: number;
  failureCount: number;
}

const API_FAILURE_THRESHOLD = 3;
const API_OPEN_TIMEOUT_MS = 15_000;
const API_MAX_ATTEMPTS = 3;
const apiCircuit: ApiCircuit = {
  state: 'closed',
  openedAt: 0,
  failureCount: 0,
};

function getCorrelationId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `api_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function refreshCircuitState() {
  if (apiCircuit.state === 'open' && Date.now() - apiCircuit.openedAt >= API_OPEN_TIMEOUT_MS) {
    apiCircuit.state = 'half-open';
    transferLogger.logCircuitState('api', 'half-open', 'api_circuit');
  }
}

function recordApiSuccess() {
  if (apiCircuit.state !== 'closed') {
    apiCircuit.state = 'closed';
    transferLogger.logCircuitState('api', 'closed', 'api_circuit');
  }
  apiCircuit.failureCount = 0;
  apiCircuit.openedAt = 0;
}

function recordApiFailure(correlationId: string, endpoint: string, attempt: number, reason: string) {
  apiCircuit.failureCount += 1;
  if (apiCircuit.failureCount >= API_FAILURE_THRESHOLD) {
    apiCircuit.state = 'open';
    apiCircuit.openedAt = Date.now();
    transferLogger.logCircuitState('api', 'open', correlationId, { endpoint, reason });
    return;
  }

  if (apiCircuit.state === 'half-open') {
    apiCircuit.state = 'open';
    apiCircuit.openedAt = Date.now();
    transferLogger.logCircuitState('api', 'open', correlationId, { endpoint, attempt, reason });
  }
}

function shouldRetryResponse(response: Response) {
  return response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
}

function isRetryableError(error: unknown) {
  return error instanceof TypeError || error instanceof DOMException;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  refreshCircuitState();
  const correlationId = getCorrelationId();
  const endpoint = apiUrl(path);
  if (apiCircuit.state === 'open') {
    const error = new Error('API temporarily unavailable. Please try again shortly.');
    transferLogger.logCircuitState('api', 'open', correlationId, { endpoint, reason: 'circuit open' });
    throw error;
  }

  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= API_MAX_ATTEMPTS; attempt += 1) {
    const startedAt = performance.now();
    transferLogger.logApiRequest(endpoint, attempt, correlationId, {
      method: init?.method || 'GET',
    });

    try {
      const response = await fetch(endpoint, {
        ...init,
        credentials: 'include',
        headers,
      });
      const durationMs = Math.round(performance.now() - startedAt);

      if (response.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new Event('swiftsend:unauthorized'));
      }

      if (!response.ok && shouldRetryResponse(response)) {
        recordApiFailure(correlationId, endpoint, attempt, `status_${response.status}`);
        if (attempt < API_MAX_ATTEMPTS) {
          transferLogger.logApiRetry(endpoint, attempt, correlationId, `Retrying after ${response.status}`, {
            durationMs,
          });
          continue;
        }
      } else {
        recordApiSuccess();
      }
      transferLogger.log({
        level: 'info',
        event: 'api_response',
        correlationId,
        component: 'api',
        endpoint,
        attempt,
        durationMs,
        message: `API response ${response.status} for ${endpoint}`,
        metadata: { status: response.status },
      });
      return response;
    } catch (error) {
      lastError = error;
      const durationMs = Math.round(performance.now() - startedAt);
      if (attempt < API_MAX_ATTEMPTS && isRetryableError(error)) {
        transferLogger.logApiRetry(endpoint, attempt, correlationId, 'Retrying after network failure', {
          durationMs,
          error: error instanceof Error ? error.message : String(error),
        });
        recordApiFailure(correlationId, endpoint, attempt, error instanceof Error ? error.message : String(error));
        continue;
      }
      recordApiFailure(correlationId, endpoint, attempt, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('API request failed');
}
