import { FastifyInstance } from 'fastify';
import { requireVerifiedSession } from '../middleware/authenticate';

interface EscrowOverrideBody {
  destination_account?: string;
}

export default async function escrowRoutes(fastify: FastifyInstance) {
  fastify.post('/escrow/:transferId/release', { preHandler: [requireVerifiedSession] }, async (req, reply) => {
    const transferId = (req.params as { transferId: string }).transferId;
    const escrow = await fastify.container.services.wallets.getEscrow(transferId);
    if (!escrow) {
      return reply.status(404).send({ error: 'escrow not found' });
    }

    const body = (req.body as EscrowOverrideBody) || {};
    const destination = body.destination_account || `recipient:${transferId}`;

    try {
      await fastify.container.services.wallets.settleEscrow({
        transferId,
        destinationAccount: destination,
        amount: escrow.amount,
        currency: escrow.currency,
        metadata: { reason: 'manual_release' },
      });
      return { ...escrow, status: 'released', destination };
    } catch (err: any) {
      return reply.status(err?.statusCode || 500).send({ error: err?.message || 'release failed' });
    }
  });

  fastify.post('/escrow/:transferId/refund', { preHandler: [requireVerifiedSession] }, async (req, reply) => {
    const transferId = (req.params as { transferId: string }).transferId;
    const escrow = await fastify.container.services.wallets.getEscrow(transferId);
    if (!escrow) {
      return reply.status(404).send({ error: 'escrow not found' });
    }

    try {
      await fastify.container.services.wallets.refundEscrow({
        transferId,
        destinationAccount: `wallet:${transferId}`,
        amount: escrow.amount,
        currency: escrow.currency,
        metadata: { reason: 'manual_refund' },
      });
      return { ...escrow, status: 'refunded' };
    } catch (err: any) {
      return reply.status(err?.statusCode || 500).send({ error: err?.message || 'refund failed' });
    }
  });
}
