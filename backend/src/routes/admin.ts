import type { FastifyInstance } from 'fastify';
import { requireVerifiedSession } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';
import { getSession, saveSession } from '../auth/sessionStore';
import type { JwtSessionPayload } from '../auth/sessionTypes';

interface SetGateBody {
  open: boolean;
}

interface SetAllowBody {
  userId: string;
  allow: boolean;
}

interface SetRoleBody {
  userId: string;
  role: 'admin' | 'user';
}

export default async function adminRoutes(fastify: FastifyInstance) {
  const adminGuards = { preHandler: [requireVerifiedSession, requireRole('admin')] };

  /** GET /admin/rbac/status — view current Access Guard state */
  fastify.get('/admin/rbac/status', adminGuards, async (req) => {
    return fastify.container.services.accessGuard.getStatus();
  });

  /** POST /admin/rbac/gate — open or close the system-wide transfer gate */
  fastify.post<{ Body: SetGateBody }>(
    '/admin/rbac/gate',
    adminGuards,
    async (req, reply) => {
      if (typeof req.body?.open !== 'boolean') {
        return reply.code(400).send({ error: '`open` (boolean) is required' });
      }
      const payload = req.user as JwtSessionPayload;
      fastify.container.services.accessGuard.setGate(req.body.open, payload.sub);
      return { gateOpen: req.body.open };
    },
  );

  /** POST /admin/rbac/allow — explicitly allow or block a user */
  fastify.post<{ Body: SetAllowBody }>(
    '/admin/rbac/allow',
    adminGuards,
    async (req, reply) => {
      const { userId, allow } = req.body ?? {};
      if (!userId || typeof allow !== 'boolean') {
        return reply.code(400).send({ error: '`userId` and `allow` (boolean) are required' });
      }
      const payload = req.user as JwtSessionPayload;
      fastify.container.services.accessGuard.setAllow(userId, allow, payload.sub);
      return { userId, allow };
    },
  );

  /** POST /admin/rbac/role — assign a role to a user */
  fastify.post<{ Body: SetRoleBody }>(
    '/admin/rbac/role',
    adminGuards,
    async (req, reply) => {
      const { userId, role } = req.body ?? {};
      if (!userId || !['admin', 'user'].includes(role)) {
        return reply.code(400).send({ error: '`userId` and `role` (admin|user) are required' });
      }
      const payload = req.user as JwtSessionPayload;
      fastify.container.services.accessGuard.setRole(userId, role, payload.sub);

      // Persist role into the session so it's reflected immediately
      const session = getSession(userId);
      if (session) {
        session.role = role;
        saveSession(session);
      }

      return { userId, role };
    },
  );
}
