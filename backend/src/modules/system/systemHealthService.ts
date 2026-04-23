import { config } from '../../config';
import { ComplianceService } from '../compliance/complianceService';
import { WalletService } from '../wallets/walletService';

export class SystemHealthService {
  constructor(private readonly compliance: ComplianceService, private readonly wallets: WalletService) {}

  async liveness() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }

  async readiness() {
    const stellarHealth = await this.checkStellarHealth();
    return {
      status: stellarHealth.status === 'online' ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: config.env,
      stellar: {
        network: config.stellar.network,
        horizonUrl: config.stellar.horizonUrl,
        status: stellarHealth.status,
        latencyMs: stellarHealth.latencyMs,
        checkedAt: stellarHealth.checkedAt,
      },
      queues: {
        settlementDelayMs: config.queues.settlementDelayMs,
        maxAttempts: config.queues.maxSettlementAttempts,
      },
    };
  }

  private async checkStellarHealth() {
    const controller = new AbortController();
    const startedAt = Date.now();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(config.stellar.horizonUrl, {
        method: 'GET',
        signal: controller.signal,
      });
      const latencyMs = Date.now() - startedAt;

      return {
        status: response.ok ? 'online' as const : 'offline' as const,
        latencyMs,
        checkedAt: new Date().toISOString(),
      };
    } catch {
      return {
        status: 'offline' as const,
        latencyMs: null,
        checkedAt: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
