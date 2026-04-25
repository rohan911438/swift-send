import { RecurringPaymentService } from './recurringPaymentService';
import { logger } from '../../logger';

export class RecurringPaymentWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private readonly service: RecurringPaymentService,
    private readonly pollIntervalMs: number = 60000 // default 1 minute
  ) {}

  start() {
    if (this.intervalId) return;

    logger.info({ pollIntervalMs: this.pollIntervalMs }, 'starting recurring payment worker');
    this.intervalId = setInterval(() => this.run(), this.pollIntervalMs);
    
    // Also run immediately
    void this.run();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('recurring payment worker stopped');
  }

  private async run() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const processed = await this.service.processDuePayments();
      if (processed > 0) {
        logger.info({ processed }, 'recurring payment run completed');
      }
    } catch (err) {
      logger.error({ err }, 'error in recurring payment worker run');
    } finally {
      this.isProcessing = false;
    }
  }
}
