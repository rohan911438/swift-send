import { FastifyPluginAsync } from 'fastify';
import { AppContainer } from '../container';
import { authenticate } from '../middleware/authenticate';

const recurringPaymentRoutes: FastifyPluginAsync = async (app) => {
  const { recurringPayments } = (app.container as AppContainer).services;

  app.post('/recurring-payments', {
    preHandler: [authenticate],
    handler: async (req, reply) => {
      const { user } = req;
      const body = req.body as any;

      const schedule = await recurringPayments.schedulePayment({
        userId: user.sub,
        fromWalletId: body.fromWalletId,
        recipientWallet: body.recipientWallet,
        amount: body.amount,
        currency: body.currency,
        frequency: body.frequency,
        customFrequencySeconds: body.customFrequencySeconds,
        endDate: body.endDate,
        metadata: body.metadata,
      });

      return reply.code(201).send(schedule);
    },
  });

  app.get('/recurring-payments', {
    preHandler: [authenticate],
    handler: async (req) => {
      const { user } = req;
      return await recurringPayments.getSchedulesForUser(user.sub);
    },
  });

  app.delete('/recurring-payments/:id', {
    preHandler: [authenticate],
    handler: async (req, reply) => {
      const { user } = req;
      const { id } = req.params as { id: string };

      await recurringPayments.cancelSchedule(id, user.sub);
      return reply.code(204).send();
    },
  });
};

export default recurringPaymentRoutes;
