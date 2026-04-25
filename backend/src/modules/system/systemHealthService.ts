import { config } from '../../config';
import { ComplianceService } from '../compliance/complianceService';
import { WalletService } from '../wallets/walletService';

export class SystemHealthService {
  constructor(private readonly compliance: ComplianceService, private readonly wallets: WalletService) {}
  private readinessCache?: {
    expiresAt: number;
    stellar: {
      status: 'online' | 'offline';
      latencyMs: number | null;
      checkedAt: string;
    };
    database: {
      status: 'online' | 'offline';
      checkedAt: string;
    };
  };

  async liveness() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }

  async readiness() {
    const stellarHealth = await this.checkStellarHealth();
    const databaseHealth = this.checkDatabaseHealth();
    
    const allHealthy = stellarHealth.status === 'online' && databaseHealth.status === 'online';
    
    return {
      status: allHealthy ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: config.env,
      stellar: {
        network: config.stellar.network,
        horizonUrl: config.stellar.horizonUrl,
        status: stellarHealth.status,
        latencyMs: stellarHealth.latencyMs,
        checkedAt: stellarHealth.checkedAt,
      },
      database: {
        status: databaseHealth.status,
        checkedAt: databaseHealth.checkedAt,
      },
      queues: {
        settlementDelayMs: config.queues.settlementDelayMs,
        maxAttempts: config.queues.maxSettlementAttempts,
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  async detailedHealth() {
    const stellarHealth = await this.checkStellarHealth();
    const databaseHealth = this.checkDatabaseHealth();
    const contractHealth = this.checkContractConnectivity();
    
    const checks = {
      stellar: stellarHealth,
      database: databaseHealth,
      contracts: contractHealth,
    };

    const healthyCount = Object.values(checks).filter(c => c.status === 'online').length;
    const totalCount = Object.keys(checks).length;
    const overallStatus = healthyCount === totalCount ? 'healthy' : healthyCount > 0 ? 'degraded' : 'unhealthy';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      environment: config.env,
      uptime: process.uptime(),
      uptimeFormatted: this.formatUptime(process.uptime()),
      memory: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
      },
      checks,
      summary: {
        total: totalCount,
        healthy: healthyCount,
        unhealthy: totalCount - healthyCount,
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

    try {
      const response = await fetch(config.stellar.horizonUrl, {
        method: 'GET',
        signal: controller.signal,
      });
      const latencyMs = Date.now() - startedAt;

      const stellar = {
        status: response.ok ? 'online' as const : 'offline' as const,
        latencyMs,
        checkedAt: new Date().toISOString(),
      };
      
      if (!this.readinessCache) {
        this.readinessCache = {
          expiresAt: Date.now() + config.performance.healthCacheTtlMs,
          stellar,
          database: { status: 'online', checkedAt: new Date().toISOString() },
        };
      } else {
        this.readinessCache.stellar = stellar;
        this.readinessCache.expiresAt = Date.now() + config.performance.healthCacheTtlMs;
      }
      
      return stellar;
    } catch {
      const stellar = {
        status: 'offline' as const,
        latencyMs: null,
        checkedAt: new Date().toISOString(),
      };
      
      if (!this.readinessCache) {
        this.readinessCache = {
          expiresAt: Date.now() + config.performance.healthCacheTtlMs,
          stellar,
          database: { status: 'online', checkedAt: new Date().toISOString() },
        };
      } else {
        this.readinessCache.stellar = stellar;
        this.readinessCache.expiresAt = Date.now() + config.performance.healthCacheTtlMs;
      }
      
      return stellar;
    } finally {
      clearTimeout(timeout);
    }
  }

  private checkDatabaseHealth() {
    // For in-memory implementation, database is always healthy
    // When PostgreSQL is integrated, this would check the connection
    const status = 'online';
    
    if (!this.readinessCache) {
      this.readinessCache = {
        expiresAt: Date.now() + config.performance.healthCacheTtlMs,
        stellar: { status: 'online', latencyMs: 0, checkedAt: new Date().toISOString() },
        database: { status, checkedAt: new Date().toISOString() },
      };
    } else {
      this.readinessCache.database = { status, checkedAt: new Date().toISOString() };
    }

    return {
      status,
      checkedAt: new Date().toISOString(),
      type: 'in-memory',
    };
  }

  private checkContractConnectivity() {
    const contracts = config.contracts;
    const deployedContracts = Object.entries(contracts).filter(([_, address]) => address);
    
    return {
      status: deployedContracts.length > 0 ? 'online' : 'offline',
      deployedCount: deployedContracts.length,
      contracts: deployedContracts.map(([name, address]) => ({ name, address })),
      checkedAt: new Date().toISOString(),
    };
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    
    return parts.join(' ') || '< 1m';
  }
}
