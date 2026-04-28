import { FastifyInstance } from 'fastify';
import { requireVerifiedSession } from '../middleware/authenticate';
import type { JwtSessionPayload } from '../auth/sessionTypes';

export default async function refundsRoutes(fastify: FastifyInstance) {
  fastify.get('/refunds', { preHandler: [requireVerifiedSession] }, async (req, reply) => {
    const user = req.user as JwtSessionPayload;
    const userId = user.sub;

    try {
      const allTransfers = await fastify.container.services.transfers.listUserTransfers(userId);

      const refundableStates = new Set(['failed', 'held']);
      const cancelledTransfers = allTransfers.filter(
        (t) => refundableStates.has(t.state) || t.state === 'settled',
      );

      const items = cancelledTransfers.map((transfer) => {
        const isFailed = transfer.state === 'failed';
        const isSettled = transfer.state === 'settled';

        const refundStatus =
          isSettled
            ? 'completed'
            : isFailed
              ? 'processing'
              : 'pending';

        const completedAt =
          isSettled
            ? transfer.updatedAt
            : undefined;

        return {
          id: `refund-${transfer.id}`,
          transfer_id: transfer.id,
          user_id: transfer.userId,
          amount: transfer.amount,
          currency: transfer.currency,
          reason: transfer.lastError ?? (isFailed ? 'Transfer failed' : 'Transfer cancelled'),
          status: refundStatus,
          initiated_at: transfer.createdAt,
          completed_at: completedAt,
          recipient_name: transfer.recipient.metadata?.recipientName as string | undefined,
        };
      });

      return reply.status(200).send({ items, total: items.length });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to fetch refunds');
      return reply.status(500).send({ error: 'Could not load refunds' });
    }
  });
}
