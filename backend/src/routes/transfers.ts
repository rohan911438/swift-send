import { FastifyInstance } from 'fastify';
import { ValidationError } from '../errors';
import { getSession, getSessionUserBalance } from '../auth/sessionStore';
import type { JwtSessionPayload, Session } from '../auth/sessionTypes';
import { CreateTransferCommand, TransferRecord } from '../modules/transfers/domain';
import { canonicalizeSignedTransferPayload, verifySignedTransferPayload } from '../modules/transfers/requestSigning';
import { requireVerifiedSession } from '../middleware/authenticate';

interface TransferRequest {
  idempotency_key: string;
  from_wallet_id: string;
  user_id?: string;
  amount: number;
  currency: string;
  signature?: string;
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

export default async function transferRoutes(fastify: FastifyInstance) {
  fastify.post('/transfers', { preHandler: [requireVerifiedSession] }, async (req, reply) => {
    const body = req.body as TransferRequest;
    try {
      const payload = requestPayloadForSigning(body);
      const session = requireTransferSession(req.user as JwtSessionPayload);
      verifySenderAuthenticity(body, session);
      verifySignedTransferPayload(payload, body.signature, session.transactionSigningSecret);

      const command = mapRequestToCommand(body);
      const jobId = fastify.container.services.transferQueue.enqueue(command);
      return reply.status(202).send({
        queue_job_id: jobId,
        transfer_initiated: true,
        status_url: `/transfers/${jobId}/status`,
      });
    } catch (err: unknown) {
      const statusCode = err instanceof ValidationError ? err.statusCode : 400;
      const errorMessage = err instanceof Error ? err.message : 'transfer creation failed';
      const details = err instanceof ValidationError ? err.details : undefined;
      return reply.status(statusCode).send({ error: errorMessage, details });
    }
  });

  fastify.get('/transfers/:id/status', { preHandler: [requireVerifiedSession] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const job = fastify.container.services.transferQueue.getJobStatus(id);
    if (!job) {
      return reply.status(404).send({ error: 'job not found' });
    }
    return {
      queue_job_id: job.id,
      status: job.status,
      error: job.error,
      created_at: job.createdAt,
      started_at: job.startedAt,
      completed_at: job.completedAt,
    };
  });

  fastify.get('/transfers/:id', { preHandler: [requireVerifiedSession] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const transfer = await fastify.container.services.transfers.getTransfer(id);
    if (!transfer) {
      return reply.status(404).send({ error: 'transfer not found' });
    }
    return formatTransferResponse(transfer);
  });
}

function requireTransferSession(token: JwtSessionPayload): Session {
  const session = getSession(token.sub);
  if (!session) {
    throw new ValidationError('Session expired');
  }
  if (!session.user) {
    throw new ValidationError('Onboarding incomplete');
  }
  return session;
}

function verifySenderAuthenticity(body: TransferRequest, session: NonNullable<ReturnType<typeof getSession>>) {
  const expectedUserId = session.user?.id;
  const expectedWalletId = session.user?.walletAddress || session.id;

  if (body.user_id && body.user_id !== expectedUserId) {
    throw new ValidationError('sender does not match authenticated session');
  }

  if (body.from_wallet_id !== expectedWalletId) {
    throw new ValidationError('from_wallet_id does not belong to the authenticated sender');
  }
}

function requestPayloadForSigning(body: TransferRequest) {
  return {
    idempotency_key: body.idempotency_key,
    from_wallet_id: body.from_wallet_id,
    user_id: body.user_id || body.from_wallet_id,
    amount: body.amount,
    currency: body.currency,
    recipient: {
      type: body.recipient?.type || 'wallet',
      wallet_public_key: body.recipient?.wallet_public_key,
      partner_code: body.recipient?.partner_code,
      country: body.recipient?.country,
      metadata: body.recipient?.metadata,
    },
    compliance_tier: body.compliance_tier,
    metadata: body.metadata,
  };
}

function mapRequestToCommand(body: TransferRequest): CreateTransferCommand {
  const payload = requestPayloadForSigning(body);
  return {
    idempotencyKey: payload.idempotency_key,
    fromWalletId: payload.from_wallet_id,
    userId: payload.user_id,
    amount: payload.amount,
    currency: payload.currency,
    recipient: {
      type: payload.recipient.type,
      walletPublicKey: payload.recipient.wallet_public_key,
      partnerCode: payload.recipient.partner_code,
      country: payload.recipient.country,
      metadata: payload.recipient.metadata,
    },
    complianceTier: payload.compliance_tier as CreateTransferCommand['complianceTier'],
    metadata: payload.metadata,
  };
}

function formatTransferResponse(record: TransferRecord) {
  return {
    id: record.id,
    status: record.state,
    amount: record.amount,
    currency: record.currency,
    from_wallet_id: record.fromWalletId,
    recipient: record.recipient,
    escrow_id: record.escrowId,
    compliance: {
      tier: record.compliance.tier.id,
      risk_score: record.compliance.riskScore,
      warnings: record.compliance.warnings,
    },
    history: record.statusHistory,
    last_error: record.lastError,
    available_balance: getSessionUserBalance(record.userId),
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    signature_payload: canonicalizeSignedTransferPayload({
      idempotency_key: record.clientReference,
      from_wallet_id: record.fromWalletId,
      user_id: record.userId,
      amount: record.amount,
      currency: record.currency,
      recipient: {
        type: record.recipient.type,
        wallet_public_key: record.recipient.walletPublicKey,
        partner_code: record.recipient.partnerCode,
        country: record.recipient.country,
        metadata: record.recipient.metadata,
      },
      compliance_tier: record.compliance.tier.id,
      metadata: record.metadata,
    }),
  };
}
