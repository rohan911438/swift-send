import { logger } from '../../logger';
import { EventBus } from '../../core/eventBus';
import { TransferLifecycle } from './transferLifecycle';
import { CreateTransferCommand } from './domain';

export interface QueuedTransferJob {
  id: string;
  command: CreateTransferCommand;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export class TransferQueue {
  private static readonly MAX_STORED_RESULTS = 200;
  private static readonly FINISHED_JOB_TTL_MS = 15 * 60 * 1000;
  private queue: QueuedTransferJob[] = [];
  private processing = false;
  private results = new Map<string, QueuedTransferJob>();

  constructor(
    private readonly transfers: TransferLifecycle,
    private readonly eventBus: EventBus
  ) {}

  /**
   * Enqueue a transfer for serial processing.
   * Returns the queued job ID that can be polled for status.
   */
  enqueue(command: CreateTransferCommand): string {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const job: QueuedTransferJob = {
      id: jobId,
      command,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    this.queue.push(job);
    logger.debug({ jobId, queueLength: this.queue.length }, 'transfer queued');

    this.results.set(jobId, job);
    this.cleanupResults();

    void this.processQueue();
    return jobId;
  }

  /**
   * Poll the status of a queued job.
   */
  getJobStatus(jobId: string): QueuedTransferJob | null {
    return this.results.get(jobId) || null;
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const job = this.queue[0];
        job.startedAt = new Date().toISOString();
        job.status = 'processing';

        logger.debug({ jobId: job.id }, 'processing transfer from queue');

        try {
          await this.transfers.createTransfer(job.command);

          job.status = 'completed';
          job.completedAt = new Date().toISOString();

          logger.info({ jobId: job.id }, 'transfer processed successfully');

          await this.eventBus.publish({
            type: 'queue.transfer_completed',
            timestamp: new Date().toISOString(),
            payload: {
              jobId: job.id,
              transferId: job.command.idempotencyKey,
            },
          });
        } catch (error: unknown) {
          job.status = 'failed';
          job.completedAt = new Date().toISOString();
          job.error = error instanceof Error ? error.message : 'Unknown error';

          logger.error({ jobId: job.id, error }, 'transfer processing failed');

          await this.eventBus.publish({
            type: 'queue.transfer_failed',
            timestamp: new Date().toISOString(),
            payload: {
              jobId: job.id,
              transferId: job.command.idempotencyKey,
              error: job.error,
            },
          });
        }

        this.queue.shift();
        this.cleanupResults();
      }
    } finally {
      this.processing = false;
    }
  }

  private cleanupResults() {
    const now = Date.now();

    for (const [jobId, job] of this.results.entries()) {
      const finishedAt = job.completedAt ? new Date(job.completedAt).getTime() : 0;
      if (
        job.status !== 'pending' &&
        job.status !== 'processing' &&
        finishedAt > 0 &&
        now - finishedAt > TransferQueue.FINISHED_JOB_TTL_MS
      ) {
        this.results.delete(jobId);
      }
    }

    while (this.results.size > TransferQueue.MAX_STORED_RESULTS) {
      const oldestKey = this.results.keys().next().value as string | undefined;
      if (!oldestKey) {
        break;
      }
      this.results.delete(oldestKey);
    }
  }
}
