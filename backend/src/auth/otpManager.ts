/**
 * OTP (One-Time Password) management with expiration and security
 * Handles generation, validation, and expiration of verification codes
 */

import { randomInt } from "node:crypto";
import { logger } from "../logger";

export interface OTPEntry {
  code: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  verified: boolean;
}

export interface OTPConfig {
  length: number; // Number of digits
  expirationMs: number; // How long OTP is valid
  maxAttempts: number; // Max verification attempts
}

export class OTPManager {
  private otps = new Map<string, OTPEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private config: OTPConfig = {
      length: 6,
      expirationMs: 10 * 60 * 1000, // 10 minutes
      maxAttempts: 5,
    },
  ) {
    // Clean up expired OTPs every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Generate a new OTP for a user/session
   */
  generate(userId: string): string {
    // Generate random code
    const code = this.generateCode();
    const now = Date.now();

    // Store OTP
    this.otps.set(userId, {
      code,
      createdAt: now,
      expiresAt: now + this.config.expirationMs,
      attempts: 0,
      maxAttempts: this.config.maxAttempts,
      verified: false,
    });

    logger.debug(
      { userId, expiresIn: this.config.expirationMs },
      "OTP generated",
    );

    return code;
  }

  /**
   * Verify an OTP code
   */
  verify(userId: string, code: string): { valid: boolean; reason?: string } {
    const entry = this.otps.get(userId);

    if (!entry) {
      return { valid: false, reason: "No OTP found for this session" };
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.otps.delete(userId);
      logger.warn({ userId }, "OTP verification failed: code expired");
      return { valid: false, reason: "Verification code has expired" };
    }

    // Check if already verified
    if (entry.verified) {
      return { valid: false, reason: "This code has already been used" };
    }

    // Increment attempts
    entry.attempts += 1;

    // Check if max attempts exceeded
    if (entry.attempts > entry.maxAttempts) {
      this.otps.delete(userId);
      logger.warn(
        { userId, attempts: entry.attempts },
        "OTP verification failed: max attempts exceeded",
      );
      return {
        valid: false,
        reason: "Too many failed attempts. Please request a new code.",
      };
    }

    // Check if code matches
    if (code !== entry.code) {
      logger.warn(
        { userId, attempts: entry.attempts, maxAttempts: entry.maxAttempts },
        "OTP verification failed: invalid code",
      );
      return {
        valid: false,
        reason: `Invalid code. ${entry.maxAttempts - entry.attempts} attempts remaining.`,
      };
    }

    // Mark as verified
    entry.verified = true;
    logger.info({ userId }, "OTP verified successfully");

    return { valid: true };
  }

  /**
   * Check if OTP is still valid (not expired)
   */
  isValid(userId: string): boolean {
    const entry = this.otps.get(userId);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.otps.delete(userId);
      return false;
    }

    return !entry.verified;
  }

  /**
   * Get remaining time for OTP (in seconds)
   */
  getRemainingSeconds(userId: string): number {
    const entry = this.otps.get(userId);
    if (!entry) return 0;

    const remaining = entry.expiresAt - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  /**
   * Get remaining attempts for OTP
   */
  getRemainingAttempts(userId: string): number {
    const entry = this.otps.get(userId);
    if (!entry) return this.config.maxAttempts;

    return Math.max(0, entry.maxAttempts - entry.attempts);
  }

  /**
   * Invalidate an OTP (e.g., when requesting a new one)
   */
  invalidate(userId: string): void {
    this.otps.delete(userId);
    logger.debug({ userId }, "OTP invalidated");
  }

  /**
   * Get OTP info (for debugging/testing only)
   */
  getInfo(userId: string): OTPEntry | null {
    const entry = this.otps.get(userId);
    if (!entry) return null;

    return {
      ...entry,
      code: process.env.NODE_ENV === "development" ? entry.code : "***", // Hide code in production
    };
  }

  /**
   * Clean up expired OTPs
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [userId, entry] of this.otps.entries()) {
      if (now > entry.expiresAt) {
        this.otps.delete(userId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug({ cleaned }, "OTP cleanup completed");
    }
  }

  /**
   * Generate a random code
   */
  private generateCode(): string {
    let code = "";
    for (let i = 0; i < this.config.length; i++) {
      code += randomInt(0, 10);
    }
    return code;
  }

  /**
   * Destroy the OTP manager
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.otps.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalOTPs: number;
    verifiedOTPs: number;
    expiredOTPs: number;
  } {
    const now = Date.now();
    let verifiedOTPs = 0;
    let expiredOTPs = 0;

    for (const entry of this.otps.values()) {
      if (entry.verified) verifiedOTPs++;
      if (now > entry.expiresAt) expiredOTPs++;
    }

    return {
      totalOTPs: this.otps.size,
      verifiedOTPs,
      expiredOTPs,
    };
  }
}

// Export singleton instance
export const otpManager = new OTPManager({
  length: 6,
  expirationMs: 10 * 60 * 1000, // 10 minutes
  maxAttempts: 5,
});
