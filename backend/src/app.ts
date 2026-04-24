import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import healthRoutes from './routes/health';
import transferRoutes from './routes/transfers';
import escrowRoutes from './routes/escrow';
import authRoutes from './routes/auth';
import activityRoutes from './routes/activity';
import { config } from './config';
import { logger } from './logger';
import { createContainer } from './container';

export async function buildApp() {
  const app = Fastify({ logger });
  const container = createContainer();

  app.decorate('container', container);

  await app.register(cookie);
  await app.register(jwt, {
    secret: config.auth.jwtSecret,
    cookie: {
      cookieName: config.auth.cookieName,
      signed: false,
    },
  });

  await app.register(cors, {
    credentials: true,
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (config.auth.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  });

  const prefix = container.config.server.basePath;
  await app.register(authRoutes, { prefix });
  await app.register(healthRoutes, { prefix });
  await app.register(activityRoutes, { prefix });
  await app.register(transferRoutes, { prefix });
  await app.register(escrowRoutes, { prefix });

  app.addHook('onClose', async () => {
    logger.info('Server shutting down');
  });

  return app;
}

export async function start() {
  const app = await buildApp();
  await app.listen({ port: config.server.port, host: config.server.host });
}
