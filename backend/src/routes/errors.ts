import type { FastifyInstance } from "fastify";
import { requireVerifiedSession } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import type { JwtSessionPayload } from "../auth/sessionTypes";

interface LogErrorBody {
  source: "frontend" | "backend" | "stellar" | "external";
  severity: "low" | "medium" | "high" | "critical";
  category:
    | "network"
    | "validation"
    | "authentication"
    | "authorization"
    | "payment"
    | "system"
    | "unknown";
  message: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

interface ResolveErrorBody {
  notes?: string;
}

interface UpdateNotesBody {
  notes: string;
}

interface ErrorsQuery {
  source?: string;
  severity?: string;
  category?: string;
  resolved?: string;
  userId?: string;
  limit?: string;
}

interface CleanupQuery {
  daysToKeep?: string;
}

export default async function errorRoutes(fastify: FastifyInstance) {
  const adminGuards = {
    preHandler: [requireVerifiedSession, requireRole("admin")],
  };

  /** POST /errors/log — log an error (can be called from frontend or backend) */
  fastify.post<{ Body: LogErrorBody }>("/errors/log", async (req, reply) => {
    try {
      // Extract user info if authenticated
      let userId: string | undefined;

      try {
        await req.jwtVerify();
        const payload = req.user as JwtSessionPayload;
        userId = payload.sub;
      } catch {
        // Not authenticated, that's okay
      }

      const errorLog = fastify.container.services.errorLog.logError({
        source: req.body.source,
        severity: req.body.severity,
        category: req.body.category,
        message: req.body.message,
        stack: req.body.stack,
        userId,
        url: req.body.url,
        userAgent: req.body.userAgent || req.headers["user-agent"],
        metadata: req.body.metadata,
      });

      return reply.code(201).send({ errorId: errorLog.id });
    } catch (error) {
      fastify.log.error(error, "Failed to log error");
      return reply.code(500).send({ error: "Failed to log error" });
    }
  });

  /** GET /admin/errors — get all errors (admin) */
  fastify.get<{ Querystring: ErrorsQuery }>(
    "/admin/errors",
    adminGuards,
    async (req) => {
      const filters = {
        source: req.query.source as any,
        severity: req.query.severity as any,
        category: req.query.category as any,
        resolved:
          req.query.resolved === "true"
            ? true
            : req.query.resolved === "false"
              ? false
              : undefined,
        userId: req.query.userId,
        limit: req.query.limit ? Number(req.query.limit) : 100,
      };
      return fastify.container.services.errorLog.getErrors(filters);
    },
  );

  /** GET /admin/errors/stats — get error statistics (admin) */
  fastify.get("/admin/errors/stats", adminGuards, async () => {
    return fastify.container.services.errorLog.getStats();
  });

  /** GET /admin/errors/:errorId — get error by ID (admin) */
  fastify.get<{ Params: { errorId: string } }>(
    "/admin/errors/:errorId",
    adminGuards,
    async (req, reply) => {
      const error = fastify.container.services.errorLog.getErrorById(
        req.params.errorId,
      );
      if (!error) {
        return reply.code(404).send({ error: "Error log not found" });
      }
      return error;
    },
  );

  /** POST /admin/errors/:errorId/resolve — mark error as resolved (admin) */
  fastify.post<{ Params: { errorId: string }; Body: ResolveErrorBody }>(
    "/admin/errors/:errorId/resolve",
    adminGuards,
    async (req, reply) => {
      const payload = req.user as JwtSessionPayload;
      const error = fastify.container.services.errorLog.resolveError(
        req.params.errorId,
        payload.sub,
        req.body.notes,
      );
      if (!error) {
        return reply.code(404).send({ error: "Error log not found" });
      }
      return error;
    },
  );

  /** POST /admin/errors/:errorId/notes — update error notes (admin) */
  fastify.post<{ Params: { errorId: string }; Body: UpdateNotesBody }>(
    "/admin/errors/:errorId/notes",
    adminGuards,
    async (req, reply) => {
      const error = fastify.container.services.errorLog.updateNotes(
        req.params.errorId,
        req.body.notes,
      );
      if (!error) {
        return reply.code(404).send({ error: "Error log not found" });
      }
      return error;
    },
  );

  /** POST /admin/errors/cleanup — cleanup old resolved errors (admin) */
  fastify.post<{ Querystring: CleanupQuery }>(
    "/admin/errors/cleanup",
    adminGuards,
    async (req) => {
      const daysToKeep = Number(req.query.daysToKeep || 30);
      const deletedCount =
        fastify.container.services.errorLog.cleanupOldErrors(daysToKeep);
      return { deletedCount, daysToKeep };
    },
  );
}
