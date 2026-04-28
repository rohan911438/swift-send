import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import healthRoutes from "./routes/health";
import transferRoutes from "./routes/transfers";
import escrowRoutes from "./routes/escrow";
import authRoutes from "./routes/auth";
import activityRoutes from "./routes/activity";
import adminRoutes from "./routes/admin";
import countriesRoutes from "./routes/countries";
import recurringPaymentRoutes from "./routes/recurringPayments";
import contractRoutes from "./routes/contracts";
import refundsRoutes from "./routes/refunds";
import notificationRoutes from "./routes/notifications";
import complianceRoutes from "./routes/compliance";
import errorRoutes from "./routes/errors";
import feeRoutes from "./routes/fees";
import { config } from "./config";
import { logger } from "./logger";
import { createContainer } from "./container";
import { AppError } from "./errors";
import { initRedisClient, closeRedisClient } from "./utils/redisCache";

export async function buildApp() {
  const app = Fastify({ logger });
  const container = createContainer();
  await initRedisClient();

  app.decorate("container", container);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }

    logger.error({ err: error, url: request.url }, "Unhandled error");

    // Mask technical details for unknown errors
    return reply.status(500).send({
      error: "An unexpected error occurred. Please try again later.",
      code: "internal_server_error",
    });
  });

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
  await app.register(countriesRoutes, { prefix });
  await app.register(transferRoutes, { prefix });
  await app.register(escrowRoutes, { prefix });
  await app.register(adminRoutes, { prefix });
  await app.register(recurringPaymentRoutes, { prefix });
  await app.register(contractRoutes, { prefix });
  await app.register(refundsRoutes, { prefix });
  await app.register(notificationRoutes, { prefix });
  await app.register(complianceRoutes, { prefix });
  await app.register(errorRoutes, { prefix });
  await app.register(feeRoutes, { prefix });

  app.addHook("onClose", async () => {
    logger.info("Server shutting down");
    await closeRedisClient();
  });

  return app;
}

export async function start() {
  const app = await buildApp();
  await app.listen({ port: config.server.port, host: config.server.host });
}
