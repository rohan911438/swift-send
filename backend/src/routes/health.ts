import { FastifyInstance } from 'fastify';

export default async function healthRoutes(fastify: FastifyInstance) {
  // Basic liveness check
  fastify.get('/health', async () => fastify.container.services.health.readiness());
  fastify.get('/health/live', async () => fastify.container.services.health.liveness());
  fastify.get('/health/ready', async () => fastify.container.services.health.readiness());
  
  // Detailed health check with all systems
  fastify.get('/health/detailed', async () => fastify.container.services.health.detailedHealth());
  
  // Contract status endpoint
  fastify.get('/health/contracts', async () => {
    return {
      status: 'operational',
      contracts: fastify.container.services.contracts.getContractInfo(),
      timestamp: new Date().toISOString(),
    };
  });

  // Contract deployment readiness endpoint
  fastify.get('/health/contracts/readiness', async () => {
    return {
      status: 'ready',
      readiness: fastify.container.services.contracts.getDeploymentReadiness(),
      instructions: {
        build: 'cd contracts && soroban contract build',
        deploy: 'soroban contract deploy --wasm target/wasm32-unknown-unknown/release/[contract_name].wasm --source-account [ACCOUNT] --network testnet',
        note: 'Update environment variables after deployment'
      },
      timestamp: new Date().toISOString(),
    };
  });
}
