import type { FastifyInstance } from "fastify";
import { requireVerifiedSession } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import type { JwtSessionPayload } from "../auth/sessionTypes";

interface UpdateNotesBody {
  notes: string;
}

interface ComplianceLogsQuery {
  limit?: string;
}

interface AdminComplianceLogsQuery {
  checkType?: string;
  status?: string;
  minRiskScore?: string;
  limit?: string;
}

export default async function complianceRoutes(fastify: FastifyInstance) {
  const authGuards = { preHandler: [requireVerifiedSession] };
  const adminGuards = {
    preHandler: [requireVerifiedSession, requireRole("admin")],
  };

  /** GET /compliance/logs — get user's own compliance logs */
  fastify.get<{ Querystring: ComplianceLogsQuery }>(
    "/compliance/logs",
    authGuards,
    async (req) => {
      const payload = req.user as JwtSessionPayload;
      const limit = Number(req.query.limit || 50);
      return fastify.container.services.complianceLog.getLogsByUserId(
        payload.sub,
        limit,
      );
    },
  );

  /** GET /compliance/logs/transfer/:transferId — get logs for a specific transfer */
  fastify.get<{ Params: { transferId: string } }>(
    "/compliance/logs/transfer/:transferId",
    authGuards,
    async (req) => {
      return fastify.container.services.complianceLog.getLogsByTransferId(
        req.params.transferId,
      );
    },
  );

  /** GET /admin/compliance/logs — get all compliance logs (admin) */
  fastify.get<{ Querystring: AdminComplianceLogsQuery }>(
    "/admin/compliance/logs",
    adminGuards,
    async (req) => {
      const filters = {
        checkType: req.query.checkType as any,
        status: req.query.status as any,
        minRiskScore: req.query.minRiskScore
          ? Number(req.query.minRiskScore)
          : undefined,
        limit: req.query.limit ? Number(req.query.limit) : 100,
      };
      return fastify.container.services.complianceLog.getAllLogs(filters);
    },
  );

  /** GET /admin/compliance/flagged — get flagged transactions (admin) */
  fastify.get<{ Querystring: ComplianceLogsQuery }>(
    "/admin/compliance/flagged",
    adminGuards,
    async (req) => {
      const limit = Number(req.query.limit || 100);
      return fastify.container.services.complianceLog.getFlaggedTransactions(
        limit,
      );
    },
  );

  /** POST /admin/compliance/logs/:logId/notes — update log notes (admin) */
  fastify.post<{ Params: { logId: string }; Body: UpdateNotesBody }>(
    "/admin/compliance/logs/:logId/notes",
    adminGuards,
    async (req, reply) => {
      const payload = req.user as JwtSessionPayload;
      const log = fastify.container.services.complianceLog.updateLogNotes(
        req.params.logId,
        req.body.notes,
        payload.sub,
      );
      if (!log) {
        return reply.code(404).send({ error: "Log not found" });
      }
      return log;
    },
  );
}
