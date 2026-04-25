import { FastifyInstance } from 'fastify';
import { requireVerifiedSession } from '../middleware/authenticate';

export default async function fraudRoutes(fastify: FastifyInstance) {
  fastify.get('/fraud/alerts', { preHandler: [requireVerifiedSession] }, async (req, reply) => {
    const token = req.user as { sub: string };
    const alerts = fastify.container.services.fraud.getSuspiciousAlerts(token.sub);
    return { alerts, total: alerts.length };
  });

  fastify.get('/fraud/alerts/:id', { preHandler: [requireVerifiedSession] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const token = req.user as { sub: string };
    const alerts = fastify.container.services.fraud.getSuspiciousAlerts(token.sub);
    const alert = alerts.find((a) => a.id === id);
    
    if (!alert) {
      return reply.status(404).send({ error: 'Alert not found' });
    }
    
    return { alert };
  });

  fastify.post('/fraud/alerts/:id/acknowledge', { preHandler: [requireVerifiedSession] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const alert = fastify.container.services.fraud.acknowledgeAlert(id);
    
    if (!alert) {
      return reply.status(404).send({ error: 'Alert not found' });
    }
    
    return { alert, acknowledged: true };
  });

  fastify.get('/fraud/audit', { preHandler: [requireVerifiedSession] }, async (req, reply) => {
    const token = req.user as { sub: string };
    const entries = fastify.container.services.fraud.listAuditEntries(token.sub);
    return { entries, total: entries.length };
  });
}
