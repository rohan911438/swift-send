import 'fastify';
import type { AppContainer } from '../container';
import type { JwtSessionPayload } from '../auth/sessionTypes';

declare module 'fastify' {
  interface FastifyInstance {
    container: AppContainer;
  }
  
  interface FastifyRequest {
    user?: JwtSessionPayload;
    jwtVerify: (options?: { onlyCookie: boolean }) => Promise<JwtSessionPayload>;
  }
  
  interface FastifyReply {
    jwtSign: (payload: JwtSessionPayload, options?: { expiresIn: number }) => Promise<string>;
    setCookie: (name: string, value: string, options?: Record<string, any>) => FastifyReply;
    clearCookie: (name: string, options?: Record<string, any>) => FastifyReply;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtSessionPayload;
    user: JwtSessionPayload;
  }
}
