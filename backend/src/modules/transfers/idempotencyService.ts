import { logger } from '../../logger';

export interface IdempotencyRecord {
  key: string;
  userId: string;
  status: 'processing' | 'completed' | 'failed';
  response?: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
}

export class IdempotencyService {
  private readonly store = new Map<string, IdempotencyRecord>();
  private readonly cleanupInterval: any = null;

  constructor(cleanupIntervalMs = 30 * 60 * 1000) {
    // Clean up old records every 30 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
  }

  /**
   * Check if an idempotency key already exists
   * Returns the existing record if found and completed
   */
  checkIdempotency(key: string, userId: string): IdempotencyRecord | null {
    const record = this.store.get(key);
    
    if (!record) {
      return null;
    }

    // Verify ownership
    if (record.userId !== userId) {
      logger.warn({ key, userId, recordUserId: record.userId }, 'Idempotency key ownership mismatch');
      return null;
    }

    // If still processing, return the record to prevent duplicate
    if (record.status === 'processing') {
      return record;
    }

    // If completed, return the cached response
    if (record.status === 'completed' && record.response) {
      logger.debug({ key }, 'Returning cached idempotent response');
      return record;
    }

    return null;
  }

  /**
   * Create a new idempotency record
   */
  createRecord(key: string, userId: string): IdempotencyRecord {
    const now = new Date().toISOString();
    const record: IdempotencyRecord = {
      key,
      userId,
      status: 'processing',
      createdAt: now,
    };

    this.store.set(key, record);
    logger.debug({ key, userId }, 'Created idempotency record');
    return record;
  }

  /**
   * Mark idempotency key as completed with response
   */
  completeRecord(key: string, response: Record<string, unknown>): IdempotencyRecord | null {
    const record = this.store.get(key);
    
    if (!record) {
      logger.warn({ key }, 'Attempted to complete non-existent idempotency record');
      return null;
    }

    record.status = 'completed';
    record.response = response;
    record.completedAt = new Date().toISOString();

    this.store.set(key, record);
    logger.debug({ key }, 'Completed idempotency record');
    return record;
  }

  /**
   * Mark idempotency key as failed
   */
  failRecord(key: string, error: string): IdempotencyRecord | null {
    const record = this.store.get(key);
    
    if (!record) {
      logger.warn({ key }, 'Attempted to fail non-existent idempotency record');
      return null;
    }

    record.status = 'failed';
    record.response = { error };
    record.completedAt = new Date().toISOString();

    this.store.set(key, record);
    logger.debug({ key, error }, 'Failed idempotency record');
    return record;
  }

  /**
   * Clean up old records (older than 24 hours)
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    let cleaned = 0;

    for (const [key, record] of this.store.entries()) {
      const recordAge = now - new Date(record.createdAt).getTime();
      if (recordAge > maxAge) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug({ cleaned }, 'Idempotency cleanup completed');
    }
  }

  /**
   * Destroy the service and clean up interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalRecords: number;
    processingCount: number;
    completedCount: number;
    failedCount: number;
  } {
    let processingCount = 0;
    let completedCount = 0;
    let failedCount = 0;

    for (const record of this.store.values()) {
      switch (record.status) {
        case 'processing':
          processingCount++;
          break;
        case 'completed':
          completedCount++;
          break;
        case 'failed':
          failedCount++;
          break;
      }
    }

    return {
      totalRecords: this.store.size,
      processingCount,
      completedCount,
      failedCount,
    };
  }
}
