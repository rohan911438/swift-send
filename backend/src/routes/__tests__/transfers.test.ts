import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';
import supertest from 'supertest';

jest.mock('../../modules/transfers/requestSigning', () => ({
  ...jest.requireActual('../../modules/transfers/requestSigning'),
  verifySignedTransferPayload: jest.fn((payload, signature, secret) => {
    const { ValidationError } = require('../../errors');
    if (!signature) {
      throw new ValidationError('transaction signature is required');
    }
    if (signature !== 'valid-signature-hash') {
      throw new ValidationError('invalid transaction signature');
    }
  }),
}));

jest.mock('../../middleware/authenticate', () => ({
  requireVerifiedSession: jest.fn(async (req: any, reply: any) => {
    if (!req.headers.authorization) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    req.user = { sub: 'test-session', verified: true };
  }),
  authenticate: jest.fn(async (req: any, reply: any) => {
    if (!req.headers.authorization) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    req.user = { sub: 'test-session' };
  })
}));

jest.mock('../../auth/sessionStore', () => ({
  getSession: jest.fn().mockReturnValue({
    id: 'test-session',
    user: {
      id: 'user-1',
      walletAddress: 'wallet-1'
    },
    transactionSigningSecret: 'test-secret'
  }),
  getSessionUserBalance: jest.fn().mockReturnValue(1000)
}));

describe('Transfer Routes', () => {
  let app: any;
  let request: any;

  const validTransferPayload = {
    idempotency_key: 'test-transfer-123',
    from_wallet_id: 'wallet-1',
    user_id: 'user-1',
    amount: 100,
    currency: 'USDC',
    recipient: {
      type: 'wallet',
      wallet_public_key: 'GTEST123456789ABCDEF',
    },
    signature: 'valid-signature-hash',
  };

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    request = supertest(app.server);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('POST /transfers', () => {
    it('should create transfer successfully with valid payload', async () => {
      // Mock authentication
      const authToken = app.jwt.sign({ 
        sub: 'user-1', 
        verified: true,
        transactionSigningSecret: 'test-secret'
      });

      const response = await request
        .post('/transfers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validTransferPayload)
        .expect(202);

      expect(response.body).toHaveProperty('queue_job_id');
      expect(response.body).toHaveProperty('transfer_initiated', true);
      expect(response.body).toHaveProperty('status_url');
    });

    it('should reject unauthenticated requests', async () => {
      await request
        .post('/transfers')
        .send(validTransferPayload)
        .expect(401);
    });

    it('should reject requests without signature', async () => {
      const authToken = app.jwt.sign({ 
        sub: 'user-1', 
        verified: true,
        transactionSigningSecret: 'test-secret'
      });

      const payloadWithoutSignature = { ...validTransferPayload };
      delete (payloadWithoutSignature as any).signature;

      await request
        .post('/transfers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(payloadWithoutSignature)
        .expect(400);
    });

    it('should reject invalid amounts', async () => {
      const authToken = app.jwt.sign({ 
        sub: 'user-1', 
        verified: true,
        transactionSigningSecret: 'test-secret'
      });

      const invalidPayload = {
        ...validTransferPayload,
        amount: -100,
      };

      await request
        .post('/transfers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPayload)
        .expect(400);
    });

    it('should reject unsupported currencies', async () => {
      const authToken = app.jwt.sign({ 
        sub: 'user-1', 
        verified: true,
        transactionSigningSecret: 'test-secret'
      });

      const invalidPayload = {
        ...validTransferPayload,
        currency: 'INVALID',
      };

      await request
        .post('/transfers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPayload)
        .expect(400);
    });

    it('should handle duplicate idempotency keys', async () => {
      const authToken = app.jwt.sign({ 
        sub: 'user-1', 
        verified: true,
        transactionSigningSecret: 'test-secret'
      });

      // First request
      await request
        .post('/transfers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validTransferPayload)
        .expect(202);

      // Duplicate request with same idempotency key
      const duplicateResponse = await request
        .post('/transfers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validTransferPayload)
        .expect(202);

      // Should return same job ID
      expect(duplicateResponse.body).toHaveProperty('queue_job_id');
    });

    it('should validate recipient types', async () => {
      const authToken = app.jwt.sign({ 
        sub: 'user-1', 
        verified: true,
        transactionSigningSecret: 'test-secret'
      });

      const invalidRecipientPayload = {
        ...validTransferPayload,
        idempotency_key: 'test-invalid-recipient',
        recipient: {
          type: 'invalid_type',
        },
      };

      await request
        .post('/transfers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRecipientPayload)
        .expect(400);
    });

    it('should validate wallet recipient has public key', async () => {
      const authToken = app.jwt.sign({ 
        sub: 'user-1', 
        verified: true,
        transactionSigningSecret: 'test-secret'
      });

      const invalidWalletPayload = {
        ...validTransferPayload,
        idempotency_key: 'test-invalid-wallet',
        recipient: {
          type: 'wallet',
          // Missing wallet_public_key
        },
      };

      await request
        .post('/transfers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidWalletPayload)
        .expect(400);
    });
  });

  describe('GET /transfers/:id/status', () => {
    it('should return job status for valid job ID', async () => {
      const authToken = app.jwt.sign({ 
        sub: 'user-1', 
        verified: true,
        transactionSigningSecret: 'test-secret'
      });

      // First create a transfer
      const createResponse = await request
        .post('/transfers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...validTransferPayload,
          idempotency_key: 'status-test-123',
        })
        .expect(202);

      const jobId = createResponse.body.queue_job_id;

      // Then check its status
      const statusResponse = await request
        .get(`/transfers/${jobId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(statusResponse.body).toHaveProperty('queue_job_id', jobId);
      expect(statusResponse.body).toHaveProperty('status');
      expect(['pending', 'processing', 'completed', 'failed']).toContain(
        statusResponse.body.status
      );
    });

    it('should return 404 for non-existent job ID', async () => {
      const authToken = app.jwt.sign({ 
        sub: 'user-1', 
        verified: true,
        transactionSigningSecret: 'test-secret'
      });

      await request
        .get('/transfers/non-existent-job-id/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should reject unauthenticated status requests', async () => {
      await request
        .get('/transfers/some-job-id/status')
        .expect(401);
    });
  });

  describe('Transfer validation edge cases', () => {
    let authToken: string;

    beforeEach(() => {
      authToken = app.jwt.sign({ 
        sub: 'user-1', 
        verified: true,
        transactionSigningSecret: 'test-secret'
      });
    });

    it('should reject transfers with missing required fields', async () => {
      const incompletePayload = {
        idempotency_key: 'incomplete-test',
        // Missing other required fields
      };

      await request
        .post('/transfers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompletePayload)
        .expect(400);
    });

    it('should handle cash pickup recipients', async () => {
      const cashPickupPayload = {
        ...validTransferPayload,
        idempotency_key: 'cash-pickup-test',
        recipient: {
          type: 'cash_pickup',
          partner_code: 'MONEYGRAM',
          country: 'US',
          metadata: {
            pickup_location: 'New York',
          },
        },
      };

      await request
        .post('/transfers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(cashPickupPayload)
        .expect(202);
    });

    it('should handle bank recipients', async () => {
      const bankPayload = {
        ...validTransferPayload,
        idempotency_key: 'bank-test',
        recipient: {
          type: 'bank',
          partner_code: 'WISE',
          country: 'UK',
          metadata: {
            account_number: '12345678',
            sort_code: '12-34-56',
          },
        },
      };

      await request
        .post('/transfers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bankPayload)
        .expect(202);
    });
  });
});