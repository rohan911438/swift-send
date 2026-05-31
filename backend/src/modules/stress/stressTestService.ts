import { createLogger } from '../../logger';
import type { TransferLifecycle } from '../transfers/transferLifecycle';

export interface StressTestConfig {
  concurrency: number;
  totalTransfers: number;
  amount: number;
  userId: string;
  walletId: string;
  chaos?: {
    apiDowntimeEvery?: number;
    blockchainLatencyMs?: number;
  };
}


export interface ChaosTestConfig extends StressTestConfig {
  apiDowntimeRate: number;
  blockchainLatencyMs: number;
}

export interface ChaosTestResult extends StressTestResult {
  downtimeInjected: number;
  latencyInjected: number;
  recoveredTransfers: number;
  recoveryRate: number;
}

export interface StressTestResult {
  runId: string;
  config: StressTestConfig;
  timestamp: string;
  durationMs: number;
  successful: number;
  failed: number;
  throughputPerSecond: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errors: string[];
  perTransferResults: PerTransferResult[];
}

export interface PerTransferResult {
  index: number;
  transferId: string;
  success: boolean;
  latencyMs: number;
  error?: string;
  recovered?: boolean;
}

export class StressTestService {
  private readonly logger;

  constructor(private readonly transfers: TransferLifecycle) {
    this.logger = createLogger({ component: 'stressTestService' });
  }


  async runChaosTest(config: ChaosTestConfig): Promise<ChaosTestResult> {
    let downtimeInjected = 0;
    let latencyInjected = 0;

    const decoratedLifecycle = {
      createTransfer: async (command: Parameters<TransferLifecycle['createTransfer']>[0]) => {
        if (Math.random() < config.apiDowntimeRate) {
          downtimeInjected += 1;
          throw new Error('Injected API downtime');
        }

        if (config.blockchainLatencyMs > 0) {
          latencyInjected += 1;
          await this.delay(config.blockchainLatencyMs);
        }

        return this.transfers.createTransfer(command);
      },
    } as TransferLifecycle;

    const baseService = new StressTestService(decoratedLifecycle);
    const baseline = await baseService.runStressTest(config);

    const downtimeFailures = baseline.perTransferResults.filter(
      (result) => !result.success && result.error?.includes('Injected API downtime'),
    );

    let recoveredTransfers = 0;
    for (const failedResult of downtimeFailures) {
      try {
        await this.transfers.createTransfer({
          idempotencyKey: `${failedResult.transferId}_recovery`,
          userId: config.userId,
          fromWalletId: config.walletId,
          amount: config.amount,
          currency: 'USDC',
          recipient: {
            type: 'wallet',
            walletPublicKey: 'GRECOVERYWALLETTEST1234567890123456789012345678',
            country: 'US',
          },
        });
        recoveredTransfers += 1;
      } catch (err) {
        this.logger.warn({ transferId: failedResult.transferId, err }, 'recovery retry failed');
      }
    }

    const recoveryRate = downtimeFailures.length > 0
      ? Math.round((recoveredTransfers / downtimeFailures.length) * 10000) / 100
      : 100;

    return {
      ...baseline,
      recoveredTransfers,
      recoveryRate,
      downtimeInjected,
      latencyInjected,
    };
  }

  async runStressTest(config: StressTestConfig): Promise<StressTestResult> {
    const runId = `stress_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const errors: string[] = [];
    const perTransferResults: PerTransferResult[] = [];
    let successful = 0;
    let failed = 0;

    this.logger.info(
      { concurrency: config.concurrency, total: config.totalTransfers },
      'starting stress test',
    );

    const startTime = Date.now();

    const batches: Array<Array<number>> = [];
    for (let i = 0; i < config.totalTransfers; i += config.concurrency) {
      batches.push(
        Array.from({ length: Math.min(config.concurrency, config.totalTransfers - i) }, (_, j) => i + j),
      );
    }

    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map((index) => this.executeSingleTransfer(config, index, runId)),
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          perTransferResults.push(result.value);
          if (result.value.success) {
            successful++;
          } else {
            failed++;
            if (result.value.error) errors.push(result.value.error);
          }
        } else {
          failed++;
          errors.push(result.reason?.message || 'Unknown error');
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const latencies = perTransferResults
      .filter((r) => r.success)
      .map((r) => r.latencyMs)
      .sort((a, b) => a - b);

    const averageLatencyMs = latencies.length > 0
      ? Math.round(latencies.reduce((sum, l) => sum + l, 0) / latencies.length)
      : 0;

    const p95LatencyMs = latencies.length > 0
      ? latencies[Math.floor(latencies.length * 0.95)]
      : 0;

    const p99LatencyMs = latencies.length > 0
      ? latencies[Math.floor(latencies.length * 0.99)]
      : 0;

    const result: StressTestResult = {
      runId,
      config,
      timestamp: new Date().toISOString(),
      durationMs,
      successful,
      failed,
      throughputPerSecond: durationMs > 0
        ? Math.round((successful / durationMs) * 1000 * 100) / 100
        : 0,
      averageLatencyMs,
      p95LatencyMs,
      p99LatencyMs,
      errors: [...new Set(errors)].slice(0, 50),
      perTransferResults,
    };

    this.logger.info(
      {
        runId,
        durationMs,
        successful,
        failed,
        throughputPerSecond: result.throughputPerSecond,
        averageLatencyMs,
      },
      'stress test completed',
    );

    return result;
  }

  private delay(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private async executeSingleTransfer(
    config: StressTestConfig,
    index: number,
    runId: string,
  ): Promise<PerTransferResult> {
    const transferStart = Date.now();
    const transferId = `stress_${runId}_${index}`;

    try {
      if (config.chaos?.apiDowntimeEvery && config.chaos.apiDowntimeEvery > 0) {
        const shouldFail = (index + 1) % config.chaos.apiDowntimeEvery === 0;
        if (shouldFail) {
          throw new Error('Simulated API downtime');
        }
      }

      if (config.chaos?.blockchainLatencyMs && config.chaos.blockchainLatencyMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, config.chaos?.blockchainLatencyMs));
      }

      await this.transfers.createTransfer({
        idempotencyKey: transferId,
        userId: config.userId,
        fromWalletId: config.walletId,
        amount: config.amount,
        currency: 'USDC',
        recipient: {
          type: 'wallet',
          walletPublicKey: 'GSTRESSWALLETTEST12345678901234567890123456789012',
          country: 'US',
        },
      });

      return {
        index,
        transferId,
        success: true,
        latencyMs: Date.now() - transferStart,
        recovered: Boolean(config.chaos),
      };
    } catch (err: unknown) {
      // Recovery behavior simulation: after transient chaos errors, retry once.
      const recoverable =
        err instanceof Error &&
        (err.message.includes('Simulated API downtime') || err.message.includes('timeout'));
      if (recoverable) {
        try {
          await this.transfers.createTransfer({
            idempotencyKey: `${transferId}_recovery`,
            userId: config.userId,
            fromWalletId: config.walletId,
            amount: config.amount,
            currency: 'USDC',
            recipient: {
              type: 'wallet',
              walletPublicKey: 'GSTRESSWALLETTEST12345678901234567890123456789012',
              country: 'US',
            },
          });
          return {
            index,
            transferId,
            success: true,
            latencyMs: Date.now() - transferStart,
            recovered: true,
          };
        } catch {
          // Fall through to failed result when recovery also fails.
        }
      }
      return {
        index,
        transferId,
        success: false,
        latencyMs: Date.now() - transferStart,
        error: err instanceof Error ? err.message : String(err),
        recovered: false,
      };
    }
  }
}
