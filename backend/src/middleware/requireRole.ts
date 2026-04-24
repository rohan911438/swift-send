import type { FastifyReply, FastifyRequest } from 'fastify';
import { getSession } from '../auth/sessionStore';
import type { JwtSessionPayload, UserRole } from '../auth/sessionTypes';

/**
 * Middleware factory that restricts a route to users whose session role matches
 * `required`.  Admins pass all role checks automatically.
 *
 * Usage:
 *   fastify.post('/admin/...', { preHandler: [requireVerifiedSession, requireRole('admin')] }, handler)
 */
export function requireRole(required: UserRole) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const payload = request.user as JwtSessionPayload;
    const session = getSession(payload.sub);
    if (!session) {
      await reply.code(401).send({ error: 'Session expired' });
      return;
    }
    const role = session.role ?? 'user';
    if (role !== required && role !== 'admin') {
      await reply.code(403).send({ error: 'Insufficient permissions', required });
      return;
    }
  };
}

/**
 * Middleware that checks the Access Guard allow-list.
 * Blocks non-admin users when the gate is closed or they are explicitly blocked.
 *
 * Must be placed AFTER requireVerifiedSession so `request.user` is populated.
 */
export async function requireAccessGuard(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const payload = request.user as JwtSessionPayload;
  const session = getSession(payload.sub);
  if (!session?.user) return; // requireVerifiedSession already guards this

  const accessGuard = (request.server as any).container?.services?.accessGuard;
  if (!accessGuard) return; // safety — never block if service unavailable

  const allowed = accessGuard.check(session.user.id);
  if (!allowed) {
    await reply.code(403).send({ error: 'Access denied by system policy' });
  }
}
