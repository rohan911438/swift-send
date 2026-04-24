/**
 * Rate limiting for authentication endpoints
 * Prevents brute-force attacks and abuse
 */

import { logger } from "../logger";

export interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number; // Time window in milliseconds
  lockoutDurationMs: number; // How long to lock out after max attempts
}

export interface RateLimitEntry {
  attempts: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
  lockedUntil?: number;
}

export class RateLimiter {
  private attempts = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private config: RateLimitConfig = {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
      lockoutDurationMs: 30 * 60 * 1000, // 30 minutes
    },
  ) {
    // Clean up old entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Check if a key is rate limited
   */
  isLimited(key: string): boolean {
    const entry = this.attempts.get(key);
    if (!entry) return false;

    // Check if currently locked out
    if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
      return true;
    }

    // Check if window has expired
    if (Date.now() - entry.firstAttemptAt > this.config.windowMs) {
      this.attempts.delete(key);
      return false;
    }

    return entry.attempts >= this.config.maxAttempts;
  }

  /**
   * Get remaining time until rate limit is lifted (in seconds)
   */
  getRemainingSeconds(key: string): number {
    const entry = this.attempts.get(key);
    if (!entry) return 0;

    // If locked out, return lockout duration
    if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
      return Math.ceil((entry.lockedUntil - Date.now()) / 1000);
    }

    // If in window, return time until window expires
    const windowExpiry = entry.firstAttemptAt + this.config.windowMs;
    if (Date.now() < windowExpiry) {
      return Math.ceil((windowExpiry - Date.now()) / 1000);
    }

    return 0;
  }

  /**
   * Record an attempt
   */
  recordAttempt(key: string): void {
    const entry = this.attempts.get(key);
    const now = Date.now();

    if (!entry) {
      this.attempts.set(key, {
        attempts: 1,
        firstAttemptAt: now,
        lastAttemptAt: now,
      });
      return;
    }

    // Reset if window has expired
    if (now - entry.firstAttemptAt > this.config.windowMs) {
      this.attempts.set(key, {
        attempts: 1,
        firstAttemptAt: now,
        lastAttemptAt: now,
      });
      return;
    }

    // Increment attempts
    entry.attempts += 1;
    entry.lastAttemptAt = now;

    // Lock out if max attempts reached
    if (entry.attempts >= this.config.maxAttempts) {
      entry.lockedUntil = now + this.config.lockoutDurationMs;
      logger.warn(
        { key, attempts: entry.attempts, lockedUntil: entry.lockedUntil },
        "Rate limit exceeded, account locked",
      );
    }
  }

  /**
   * Reset attempts for a key
   */
  reset(key: string): void {
    this.attempts.delete(key);
  }

  /**
   * Get attempt count for a key
   */
  getAttempts(key: string): number {
    const entry = this.attempts.get(key);
    if (!entry) return 0;

    // Reset if window has expired
    if (Date.now() - entry.firstAttemptAt > this.config.windowMs) {
      this.attempts.delete(key);
      return 0;
    }

    return entry.attempts;
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.attempts.entries()) {
      // Remove if window has expired and not locked
      if (
        now - entry.firstAttemptAt > this.config.windowMs &&
        !entry.lockedUntil
      ) {
        this.attempts.delete(key);
        cleaned++;
      }
      // Remove if lockout has expired
      else if (
        entry.lockedUntil &&
        now > entry.lockedUntil + this.config.windowMs
      ) {
        this.attempts.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug({ cleaned }, "Rate limiter cleanup completed");
    }
  }

  /**
   * Destroy the rate limiter
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.attempts.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalKeys: number;
    lockedKeys: number;
    totalAttempts: number;
  } {
    let lockedKeys = 0;
    let totalAttempts = 0;

    for (const entry of this.attempts.values()) {
      if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
        lockedKeys++;
      }
      totalAttempts += entry.attempts;
    }

    return {
      totalKeys: this.attempts.size,
      lockedKeys,
      totalAttempts,
    };
  }
}

// Export singleton instances for different endpoints
export const loginRateLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  lockoutDurationMs: 30 * 60 * 1000, // 30 minutes
});

export const verifyRateLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  lockoutDurationMs: 30 * 60 * 1000, // 30 minutes
});

export const resendRateLimiter = new RateLimiter({
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
  lockoutDurationMs: 60 * 60 * 1000, // 1 hour
});
