import type { FastifyInstance } from "fastify";

interface EstimateFeesQuery {
  amount?: string;
  currency?: string;
}

export default async function feeRoutes(fastify: FastifyInstance) {
  /** GET /fees/network — get current network fee */
  fastify.get("/fees/network", async () => {
    return fastify.container.services.stellarFee.getNetworkFee();
  });

  /** GET /fees/estimate — estimate fees for a transfer */
  fastify.get<{ Querystring: EstimateFeesQuery }>(
    "/fees/estimate",
    async (req, reply) => {
      const amount = Number(req.query.amount);
      const currency = req.query.currency || "XLM";

      if (!amount || amount <= 0) {
        return reply.code(400).send({ error: "Valid amount is required" });
      }

      return fastify.container.services.stellarFee.estimateFees(
        amount,
        currency,
      );
    },
  );

  /** GET /fees/congestion — check if network is congested */
  fastify.get("/fees/congestion", async () => {
    const congested =
      await fastify.container.services.stellarFee.isNetworkCongested();
    return { congested };
  });
}
