import { logger } from '../logger';

type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenSuccessThreshold?: number;
}

class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private openedAt = 0;

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions,
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.refreshState();

    if (this.state === 'open') {
      const error = new Error(`Circuit breaker '${this.name}' is open`);
      logger.warn({ circuit: this.name, state: this.state }, 'circuit breaker open');
      throw error;
    }

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error);
      throw error;
    }
  }

  private recordSuccess() {
    if (this.state === 'half-open') {
      this.successCount += 1;
      const threshold = this.options.halfOpenSuccessThreshold ?? 1;
      if (this.successCount >= threshold) {
        this.reset();
        logger.info({ circuit: this.name }, 'circuit breaker closed');
      }
      return;
    }

    this.failureCount = 0;
  }

  private recordFailure(error: unknown) {
    this.failureCount += 1;
    this.successCount = 0;

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'open';
      this.openedAt = Date.now();
      logger.warn(
        {
          circuit: this.name,
          failureCount: this.failureCount,
          error: error instanceof Error ? error.message : String(error),
        },
        'circuit breaker opened',
      );
      return;
    }

    if (this.state === 'half-open') {
      this.state = 'open';
      this.openedAt = Date.now();
      logger.warn({ circuit: this.name }, 'circuit breaker re-opened');
    }
  }

  private refreshState() {
    if (this.state === 'open' && Date.now() - this.openedAt >= this.options.resetTimeoutMs) {
      this.state = 'half-open';
      this.successCount = 0;
      logger.info({ circuit: this.name }, 'circuit breaker half-open');
    }
  }

  private reset() {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.openedAt = 0;
  }
}

const breakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string, options: CircuitBreakerOptions): CircuitBreaker {
  const existing = breakers.get(name);
  if (existing) {
    return existing;
  }

  const breaker = new CircuitBreaker(name, options);
  breakers.set(name, breaker);
  return breaker;
}
