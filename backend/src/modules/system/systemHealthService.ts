import { config } from '../../config';
import { createLogger } from '../../logger';
import { ComplianceService } from '../compliance/complianceService';
import { WalletService } from '../wallets/walletService';
import { getCircuitBreaker } from '../../utils/resilience';

export class SystemHealthService {
  constructor(private readonly compliance: ComplianceService, private readonly wallets: WalletService) {}
  private readonly logger = createLogger({ component: 'systemHealthService' });
  private readinessCache?: {
    expiresAt: number;
    stellar: {
      status: 'online' | 'offline';
      latencyMs: number | null;
      checkedAt: string;
    };
  };

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
    if (this.readinessCache && this.readinessCache.expiresAt > Date.now()) {
      return this.readinessCache.stellar;
    }

    const controller = new AbortController();
    const startedAt = Date.now();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const horizonBreaker = getCircuitBreaker('stellar-horizon-health', {
      failureThreshold: 3,
      resetTimeoutMs: 15_000,
    });

    try {
      const response = await horizonBreaker.execute(async () => {
        const result = await fetch(config.stellar.horizonUrl, {
          method: 'GET',
          signal: controller.signal,
        });
        if (!result.ok) {
          throw new Error(`Horizon responded with ${result.status}`);
        }
        return result;
      });
      const latencyMs = Date.now() - startedAt;

      const stellar = {
        status: response.ok ? 'online' as const : 'offline' as const,
        latencyMs,
        checkedAt: new Date().toISOString(),
      };
      this.readinessCache = {
        expiresAt: Date.now() + config.performance.healthCacheTtlMs,
        stellar,
      };
      this.logger.info({ latencyMs, status: stellar.status }, 'stellar health checked');
      return stellar;
    } catch {
      const stellar = {
        status: 'offline' as const,
        latencyMs: null,
        checkedAt: new Date().toISOString(),
      };
      this.readinessCache = {
        expiresAt: Date.now() + config.performance.healthCacheTtlMs,
        stellar,
      };
      this.logger.warn('stellar health unavailable');
      return stellar;
    } finally {
      clearTimeout(timeout);
    }
  }
}
