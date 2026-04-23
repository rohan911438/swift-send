import type { FastifyReply, FastifyRequest } from 'fastify';
import type { JwtSessionPayload } from '../auth/sessionTypes';

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify({ onlyCookie: true });
  } catch {
    await reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
}

export async function requireVerifiedSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify({ onlyCookie: true });
  } catch {
    await reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
  const payload = request.user as JwtSessionPayload;
  if (!payload.verified) {
    await reply.code(403).send({ error: 'Verification required' });
    return;
  }
}
