import { FastifyInstance } from 'fastify';
import { ValidationError } from '../errors';
import { getSession, getSessionUserBalance, isIpTrusted, updateLastKnownIp } from '../auth/sessionStore';
import type { JwtSessionPayload, Session } from '../auth/sessionTypes';
import { CreateTransferCommand, TransferRecord } from '../modules/transfers/domain';
import { canonicalizeSignedTransferPayload } from '../modules/transfers/requestSigning';
import { requireVerifiedSession } from '../middleware/authenticate';
import { requireAccessGuard } from '../middleware/requireRole';

interface TransferRequest {
  idempotency_key: string;
  from_wallet_id: string;
  user_id?: string;
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

const NETWORK_FEE = 0.00001;
const SERVICE_FEE_RATE = 0.005;
const MIN_SERVICE_FEE = 0.01;
const MAX_SERVICE_FEE = 25.0;

function computeFeeEstimate(amount: number, queueLength = 0) {
  const loadMultiplier = queueLength >= 25 ? 1.5 : queueLength >= 10 ? 1.25 : queueLength >= 5 ? 1.1 : 1;
  const adjustedNetworkFee = NETWORK_FEE * loadMultiplier;
  const adjustedServiceRate = SERVICE_FEE_RATE * (0.95 + (loadMultiplier - 1) * 0.4);
  const serviceFee = Math.min(Math.max(amount * adjustedServiceRate, MIN_SERVICE_FEE), MAX_SERVICE_FEE);
  const totalFee = adjustedNetworkFee + serviceFee;
  return {
    amount: parseFloat(amount.toFixed(4)),
    network_fee: parseFloat(adjustedNetworkFee.toFixed(5)),
    service_fee: parseFloat(serviceFee.toFixed(4)),
    total_fee: parseFloat(totalFee.toFixed(4)),
    recipient_gets: parseFloat(Math.max(0, amount - totalFee).toFixed(4)),
    fee_percentage: parseFloat(((totalFee / amount) * 100).toFixed(4)),
    optimization: {
      queue_length: queueLength,
      load_multiplier: parseFloat(loadMultiplier.toFixed(2)),
      optimized: loadMultiplier > 1,
    },
  };
}

export default async function transferRoutes(fastify: FastifyInstance) {
  fastify.get('/transfers/fee-estimate', async (req, reply) => {
    const query = req.query as { amount?: string };
    const amount = parseFloat(query.amount || '0');
    if (!Number.isFinite(amount) || amount <= 0) {
      return reply.status(400).send({ error: 'amount must be a positive number' });
    }
    if (amount > 1_000_000) {
      return reply.status(400).send({ error: 'amount exceeds maximum limit' });
    }
    const queueStats = fastify.container.services.transferQueue.getQueueStats();
    return computeFeeEstimate(amount, queueStats.queueLength);
  });

  fastify.post(
    '/transfers/simulate',
    { preHandler: [requireVerifiedSession, requireAccessGuard] },
    async (req, reply) => {
      const body = req.body as TransferRequest;
      try {
        const session = requireTransferSession(req.user as JwtSessionPayload);
        verifySenderAuthenticity(body, session);
        const command = mapRequestToCommand(body);
        const simulation = await fastify.container.services.transfers.simulateTransfer(command);
        return {
          executable: simulation.executable,
          expected_status: simulation.expected_status,
          fees: simulation.fees,
          recipient_gets: simulation.recipient_gets,
          warnings: simulation.warnings,
          compliance: simulation.compliance,
          multisig: simulation.multisig,
        };
      } catch (err: unknown) {
        const statusCode = err instanceof ValidationError ? err.statusCode : 400;
        const errorMessage = err instanceof Error ? err.message : 'transfer simulation failed';
        const details = err instanceof ValidationError ? err.details : undefined;
        return reply.status(statusCode).send({ error: errorMessage, details });
      }
    },
  );

  fastify.post('/transfers', { preHandler: [requireVerifiedSession, requireAccessGuard] }, async (req, reply) => {
    const body = req.body as TransferRequest;
    try {
      const payload = requestPayloadForSigning(body);
      const session = requireTransferSession(req.user as JwtSessionPayload);
      verifySenderAuthenticity(body, session);

      // IP Whitelisting for sensitive actions
      const clientIp = req.ip;
      updateLastKnownIp(session.id, clientIp);
      
      if (body.amount > 500 && !isIpTrusted(session.id, clientIp)) {
        return reply.status(403).send({
          error: 'Action requires verification',
          code: 'new_ip_detected',
          details: {
            message: 'This large transfer is from a new IP address. Please verify your identity.',
            ip: clientIp,
          }
        });
      }

      const command = mapRequestToCommand(body);
      fastify.container.services.transfers.validateCommand(command);

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

  fastify.get('/queue/stats', { preHandler: [requireVerifiedSession] }, async (_req, _reply) => {
    return fastify.container.services.transferQueue.getQueueStats();
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
    multisig: body.multisig?.enabled
      ? {
          threshold: body.multisig.threshold,
          signers: body.multisig.signers,
          approvals: body.multisig.approvals,
        }
      : undefined,
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
    multisig: payload.multisig
      ? {
          threshold: payload.multisig.threshold || 0,
          signers: payload.multisig.signers || [],
          approvals: (payload.multisig.approvals || []).map((approval) => ({
            approverWalletId: approval.approver_wallet_id,
            signature: approval.signature,
          })),
        }
      : undefined,
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
    fraud: record.fraud
      ? {
          score: record.fraud.score,
          level: record.fraud.level,
          requires_review: record.fraud.requiresReview,
          flags: record.fraud.flags,
          logged_at: record.fraud.loggedAt,
        }
      : undefined,
    history: record.statusHistory,
    transaction_hash: record.transactionHash,
    explorer_url: record.transactionHash
      ? `https://stellar.expert/explorer/public/tx/${record.transactionHash}`
      : undefined,
    multisig: record.multisig
      ? {
          threshold: record.multisig.threshold,
          signers: record.multisig.signers,
          approvals: record.multisig.approvals,
        }
      : undefined,
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
      multisig: record.multisig
        ? {
            threshold: record.multisig.threshold,
            signers: record.multisig.signers,
            approvals: record.multisig.approvals.map((approval) => ({
              approver_wallet_id: approval.approverWalletId,
              signature: approval.signature,
            })),
          }
        : undefined,
      metadata: record.metadata,
    }),
  };
}
