import 'fastify';
import type { AppContainer } from '../container';
import type { JwtSessionPayload } from '../auth/sessionTypes';

declare module 'fastify' {
  interface FastifyInstance {
    container: AppContainer;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtSessionPayload;
  }
}
