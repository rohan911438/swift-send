import {
  canonicalizeTransferPayload,
  createTransfer,
  checkTransferQueueStatus,
  simulateTransfer,
  fetchTransferFeeEstimate,
} from '../transfers';
import type { TransferCreatePayload } from '../transfers';
import { apiFetch } from '../api';

// Mock the api module
jest.mock('../api');
const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe('Transfer Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('canonicalizeTransferPayload', () => {
    it('should create consistent canonical strings for identical payloads', () => {
      const payload1: TransferCreatePayload = {
        idempotency_key: 'test-123',
        from_wallet_id: 'wallet-1',
        user_id: 'user-1',
        amount: 100,
        currency: 'USDC',
        recipient: {
          type: 'wallet',
          wallet_public_key: 'GTEST...',
        },
      };

      const payload2: TransferCreatePayload = {
        currency: 'USDC',
        amount: 100,
        user_id: 'user-1',
        from_wallet_id: 'wallet-1',
        idempotency_key: 'test-123',
        recipient: {
          wallet_public_key: 'GTEST...',
          type: 'wallet',
        },
      };

      const canonical1 = canonicalizeTransferPayload(payload1);
      const canonical2 = canonicalizeTransferPayload(payload2);

      expect(canonical1).toBe(canonical2);
    });

    it('should sort nested objects consistently', () => {
      const payload: TransferCreatePayload = {
        idempotency_key: 'test-123',
        from_wallet_id: 'wallet-1',
        user_id: 'user-1',
        amount: 100,
        currency: 'USDC',
        recipient: {
          type: 'cash_pickup',
          country: 'US',
          partner_code: 'PARTNER_1',
          metadata: {
            z_field: 'last',
            a_field: 'first',
            m_field: 'middle',
          },
        },
        metadata: {
          note: 'test transfer',
          category: 'personal',
        },
      };

      const canonical = canonicalizeTransferPayload(payload);
      const parsed = JSON.parse(canonical);

      // Check that keys are sorted at all levels
      expect(Object.keys(parsed)).toEqual([
        'amount',
        'currency',
        'from_wallet_id',
        'idempotency_key',
        'metadata',
        'recipient',
        'user_id',
      ]);

      expect(Object.keys(parsed.recipient)).toEqual([
        'country',
        'metadata',
        'partner_code',
        'type',
      ]);

      expect(Object.keys(parsed.recipient.metadata)).toEqual([
        'a_field',
        'm_field',
        'z_field',
      ]);
    });

    it('should handle arrays consistently', () => {
      const payload = {
        idempotency_key: 'test-123',
        from_wallet_id: 'wallet-1',
        user_id: 'user-1',
        amount: 100,
        currency: 'USDC',
        recipient: {
          type: 'wallet' as const,
          wallet_public_key: 'GTEST...',
        },
        metadata: {
          tags: ['personal', 'urgent', 'family'],
        },
      };

      const canonical = canonicalizeTransferPayload(payload);
      expect(canonical).toContain('["personal","urgent","family"]');
    });
  });

  describe('createTransfer', () => {
    const mockPayload: TransferCreatePayload = {
      idempotency_key: 'test-123',
      from_wallet_id: 'wallet-1',
      user_id: 'user-1',
      amount: 100,
      currency: 'USDC',
      recipient: {
        type: 'wallet',
        wallet_public_key: 'GTEST...',
      },
    };

    const mockSecret = 'test-secret-key';

    it('should successfully create a transfer', async () => {
      const mockResponse = {
        queue_job_id: 'job-123',
        transfer_initiated: true,
        status_url: '/transfers/job-123/status',
      };

      mockApiFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      const result = await createTransfer(mockPayload, mockSecret);

      expect(result).toEqual(mockResponse);
      expect(mockApiFetch).toHaveBeenCalledWith('/transfers', {
        method: 'POST',
        body: expect.stringContaining('"signature":'),
      });
    });

    it('should include signature in request body', async () => {
      mockApiFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      } as any);

      await createTransfer(mockPayload, mockSecret);

      const callArgs = mockApiFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1]?.body as string);

      expect(requestBody).toHaveProperty('signature');
      expect(typeof requestBody.signature).toBe('string');
      expect(requestBody.signature).toHaveLength(64); // HMAC-SHA256 hex string
    });

    it('should throw error on API failure', async () => {
      const errorMessage = 'Insufficient funds';
      mockApiFetch.mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({ error: errorMessage }),
      } as any);

      await expect(createTransfer(mockPayload, mockSecret)).rejects.toThrow(errorMessage);
    });

    it('should handle JSON parsing errors', async () => {
      mockApiFetch.mockResolvedValue({
        ok: false,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as any);

      await expect(createTransfer(mockPayload, mockSecret)).rejects.toThrow('Transfer failed');
    });
  });

  describe('checkTransferQueueStatus', () => {
    it('should return job status successfully', async () => {
      const mockStatus = {
        queue_job_id: 'job-123',
        status: 'completed' as const,
        created_at: '2024-01-01T00:00:00Z',
        completed_at: '2024-01-01T00:00:05Z',
      };

      mockApiFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockStatus),
      } as any);

      const result = await checkTransferQueueStatus('job-123');

      expect(result).toEqual(mockStatus);
      expect(mockApiFetch).toHaveBeenCalledWith('/transfers/job-123/status');
    });

    it('should throw error when job not found', async () => {
      mockApiFetch.mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({ error: 'Job not found' }),
      } as any);

      await expect(checkTransferQueueStatus('invalid-job')).rejects.toThrow('Job not found');
    });

    it('should handle failed jobs', async () => {
      const mockStatus = {
        queue_job_id: 'job-123',
        status: 'failed' as const,
        error: 'Network timeout',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockApiFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockStatus),
      } as any);

      const result = await checkTransferQueueStatus('job-123');

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Network timeout');
    });
  });

  describe('simulateTransfer', () => {
    it('should return simulation result successfully', async () => {
      const mockSimulation = {
        executable: true,
        expected_status: 'submitted',
        fees: {
          network_fee: 0.00001,
          service_fee: 0.5,
          total_fee: 0.50001,
        },
        recipient_gets: 99.4999,
        warnings: [],
        compliance: {
          tier: 'basic',
          can_proceed: true,
        },
      };

      mockApiFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockSimulation),
      } as any);

      const result = await simulateTransfer({
        idempotency_key: 'simulate-1',
        from_wallet_id: 'wallet-1',
        user_id: 'user-1',
        amount: 100,
        currency: 'USDC',
        recipient: {
          type: 'wallet',
          wallet_public_key: 'GTEST...',
        },
      });

      expect(result).toEqual(mockSimulation);
      expect(mockApiFetch).toHaveBeenCalledWith('/transfers/simulate', {
        method: 'POST',
        body: expect.any(String),
      });
    });
  });

  describe('fetchTransferFeeEstimate', () => {
    it('should return fee estimate successfully', async () => {
      const mockEstimate = {
        amount: 100,
        network_fee: 0.00001,
        service_fee: 0.5,
        total_fee: 0.50001,
        recipient_gets: 99.4999,
        fee_percentage: 0.5,
        optimization: {
          queue_length: 2,
          load_multiplier: 1,
          optimized: false,
        },
      };

      mockApiFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockEstimate),
      } as any);

      const result = await fetchTransferFeeEstimate(100);

      expect(result).toEqual(mockEstimate);
      expect(mockApiFetch).toHaveBeenCalledWith('/transfers/fee-estimate?amount=100');
    });
  });
});
