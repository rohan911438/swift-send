import type { FastifyInstance, FastifyReply } from 'fastify';
import { getSession } from '../auth/sessionStore';
import type { JwtSessionPayload, PublicUser, Session } from '../auth/sessionTypes';

type VerifiedSession = Session & { user: PublicUser };
import { requireVerifiedSession } from '../middleware/authenticate';

interface ActivityQuery {
  limit?: string;
}

interface SearchQuery {
  q?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: string;
  amountMax?: string;
  limit?: string;
  offset?: string;
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

  fastify.get<{ Querystring: SearchQuery }>(
    '/activity/transactions/search',
    { preHandler: [requireVerifiedSession] },
    async (req, reply) => {
      const session = requireSessionUser(req.user as JwtSessionPayload, reply);
      if (!session) return;

      const q = req.query ?? {};
      const status = ['pending', 'completed', 'failed'].includes(q.status ?? '')
        ? (q.status as 'pending' | 'completed' | 'failed')
        : undefined;

      const result = await fastify.container.services.activity.searchTransactions(
        session.user!.id,
        {
          q: q.q,
          status,
          dateFrom: q.dateFrom,
          dateTo: q.dateTo,
          amountMin: q.amountMin !== undefined ? parseFloat(q.amountMin) : undefined,
          amountMax: q.amountMax !== undefined ? parseFloat(q.amountMax) : undefined,
          limit: sanitizeLimit(q.limit, 50, 100),
          offset: q.offset !== undefined ? Math.max(0, parseInt(q.offset, 10) || 0) : 0,
        },
      );

      reply.header('Cache-Control', 'no-store');
      return result;
    },
  );

  fastify.get(
    '/activity/export',
    { preHandler: [requireVerifiedSession] },
    async (req, reply) => {
      const session = requireSessionUser(req.user as JwtSessionPayload, reply);
      if (!session) return;

      const buffer = await fastify.container.services.activity.exportTransactionsToExcel(session.user!.id);

      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      reply.header('Content-Disposition', 'attachment; filename=SwiftSend_Transactions.xlsx');
      reply.header('Content-Length', buffer.length.toString());
      
      return reply.send(buffer);
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

}

function requireSessionUser(token: JwtSessionPayload, reply: FastifyReply): VerifiedSession | null {
  const session = getSession(token.sub);
  if (!session) {
    reply.code(401).send({ error: 'Session expired' });
    return null;
  }
  if (!session.user) {
    reply.code(400).send({ error: 'Onboarding incomplete' });
    return null;
  }
  return session as VerifiedSession;
}

function sanitizeLimit(value: string | undefined, fallback: number, maximum: number) {
  const parsed = value ? parseInt(value, 10) : fallback;
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, maximum);
}
