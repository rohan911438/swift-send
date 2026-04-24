import type { FastifyInstance, FastifyReply } from 'fastify';
import { getSession } from '../auth/sessionStore';
import type { JwtSessionPayload, Session } from '../auth/sessionTypes';
import { requireVerifiedSession } from '../middleware/authenticate';

interface ActivityQuery {
  limit?: string;
}

export default async function activityRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: ActivityQuery }>(
    '/activity/transactions',
    { preHandler: [requireVerifiedSession] },
    async (req, reply) => {
      const session = requireSessionUser(req.user as JwtSessionPayload, reply);
      if (!session) return;
      const limit = sanitizeLimit(req.query?.limit, 50, 100);
      reply.header('Cache-Control', 'private, max-age=10');
      return {
        items: await fastify.container.services.activity.listTransactions(session.user!.id, limit),
      };
    },
  );

  fastify.get(
    '/activity/spending-insights',
    { preHandler: [requireVerifiedSession] },
    async (req, reply) => {
      const session = requireSessionUser(req.user as JwtSessionPayload, reply);
      if (!session) return;
      reply.header('Cache-Control', 'private, max-age=10');
      return fastify.container.services.activity.getSpendingInsights(session.user!.id);
    },
  );

  fastify.get<{ Querystring: ActivityQuery }>(
    '/notifications',
    { preHandler: [requireVerifiedSession] },
    async (req, reply) => {
      const session = requireSessionUser(req.user as JwtSessionPayload, reply);
      if (!session) return;
      const limit = sanitizeLimit(req.query?.limit, 10, 50);
      return fastify.container.services.notifications.listByUserId(session.user!.id, limit);
    },
  );

  fastify.post(
    '/notifications/:id/read',
    { preHandler: [requireVerifiedSession] },
    async (req, reply) => {
      const session = requireSessionUser(req.user as JwtSessionPayload, reply);
      if (!session) return;
      const notificationId = (req.params as { id: string }).id;
      const notification = fastify.container.services.notifications.markAsRead(
        session.user!.id,
        notificationId,
      );

      if (!notification) {
        return reply.code(404).send({ error: 'notification not found' });
      }

      return notification;
    },
  );
}

function requireSessionUser(token: JwtSessionPayload, reply: FastifyReply): Session | null {
  const session = getSession(token.sub);
  if (!session) {
    reply.code(401).send({ error: 'Session expired' });
    return null;
  }
  if (!session.user) {
    reply.code(400).send({ error: 'Onboarding incomplete' });
    return null;
  }
  return session;
}

function sanitizeLimit(value: string | undefined, fallback: number, maximum: number) {
  const parsed = value ? parseInt(value, 10) : fallback;
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, maximum);
}
