import { FastifyInstance } from 'fastify';
import { CreateTransferCommand, TransferRecord } from '../modules/transfers/domain';
import { requireVerifiedSession } from '../middleware/authenticate';

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
  metadata?: Record<string, unknown>;
}

export default async function transferRoutes(fastify: FastifyInstance) {
  fastify.post('/transfers', { preHandler: [requireVerifiedSession] }, async (req, reply) => {
    const body = req.body as TransferRequest;
    try {
      const command = mapRequestToCommand(body);
      const transfer = await fastify.container.services.transfers.createTransfer(command);
      return reply.status(201).send(formatTransferResponse(transfer));
    } catch (err: any) {
      const statusCode = err?.statusCode || 400;
      return reply.status(statusCode).send({ error: err?.message || 'transfer creation failed', details: err?.details });
    }
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

function mapRequestToCommand(body: TransferRequest): CreateTransferCommand {
  return {
    idempotencyKey: body.idempotency_key,
    fromWalletId: body.from_wallet_id,
    userId: body.user_id || body.from_wallet_id,
    amount: body.amount,
    currency: body.currency,
    recipient: {
      type: body.recipient?.type || 'wallet',
      walletPublicKey: body.recipient?.wallet_public_key,
      partnerCode: body.recipient?.partner_code,
      country: body.recipient?.country,
      metadata: body.recipient?.metadata,
    },
    complianceTier: body.compliance_tier as any,
    metadata: body.metadata,
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
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}
