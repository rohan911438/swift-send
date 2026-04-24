/**
 * Enhanced session management with security features
 * Handles session creation, validation, and lifecycle
 */

import { randomBytes } from "node:crypto";
import { logger } from "../logger";

export interface SessionMetadata {
  createdAt: number;
  lastActivityAt: number;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
}

export interface EnhancedSession {
  id: string;
  email?: string;
  phone?: string;
  verified: boolean;
  hasWallet: boolean;
  onboardingCompleted: boolean;
  transactionSigningSecret: string;
  user?: any;
  metadata: SessionMetadata;
  expiresAt: number;
}

export interface SessionConfig {
  sessionDurationMs: number; // How long session is valid
  inactivityTimeoutMs: number; // Inactivity timeout
  maxConcurrentSessions: number; // Max sessions per user
}

export class SessionManager {
  private sessions = new Map<string, EnhancedSession>();
  private userSessions = new Map<string, Set<string>>(); // Track sessions per user
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private config: SessionConfig = {
      sessionDurationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
      inactivityTimeoutMs: 30 * 60 * 1000, // 30 minutes
      maxConcurrentSessions: 5,
    },
  ) {
    // Clean up expired sessions every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Create a new session
   */
  create(
    email?: string,
    phone?: string,
    metadata?: Partial<SessionMetadata>,
  ): EnhancedSession {
    const sessionId = this.generateSessionId();
    const now = Date.now();

    const session: EnhancedSession = {
      id: sessionId,
      email,
      phone,
      verified: false,
      hasWallet: false,
      onboardingCompleted: false,
      transactionSigningSecret: this.generateSecret(),
      metadata: {
        createdAt: now,
        lastActivityAt: now,
        ...metadata,
      },
      expiresAt: now + this.config.sessionDurationMs,
    };

    this.sessions.set(sessionId, session);

    // Track user sessions
    const userKey = email || phone || sessionId;
    if (!this.userSessions.has(userKey)) {
      this.userSessions.set(userKey, new Set());
    }
    this.userSessions.get(userKey)!.add(sessionId);

    logger.debug({ sessionId, userKey }, "Session created");

    return session;
  }

  /**
   * Get a session
   */
  get(sessionId: string): EnhancedSession | null {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    // Check if expired
    if (Date.now() > session.expiresAt) {
      this.delete(sessionId);
      return null;
    }

    // Check if inactive
    if (
      Date.now() - session.metadata.lastActivityAt >
      this.config.inactivityTimeoutMs
    ) {
      logger.warn({ sessionId }, "Session expired due to inactivity");
      this.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Update session activity
   */
  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.metadata.lastActivityAt = Date.now();
    }
  }

  /**
   * Save/update a session
   */
  save(session: EnhancedSession): void {
    this.sessions.set(session.id, session);
    logger.debug({ sessionId: session.id }, "Session saved");
  }

  /**
   * Delete a session
   */
  delete(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Remove from user sessions
      const userKey = session.email || session.phone || sessionId;
      const userSessions = this.userSessions.get(userKey);
      if (userSessions) {
        userSessions.delete(sessionId);
        if (userSessions.size === 0) {
          this.userSessions.delete(userKey);
        }
      }

      this.sessions.delete(sessionId);
      logger.debug({ sessionId }, "Session deleted");
    }
  }

  /**
   * Check if session is valid
   */
  isValid(sessionId: string): boolean {
    return this.get(sessionId) !== null;
  }

  /**
   * Get remaining time for session (in seconds)
   */
  getRemainingSeconds(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session) return 0;

    const remaining = session.expiresAt - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  /**
   * Extend session expiration
   */
  extend(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.expiresAt = Date.now() + this.config.sessionDurationMs;
      logger.debug({ sessionId }, "Session extended");
    }
  }

  /**
   * Get all sessions for a user
   */
  getUserSessions(userKey: string): EnhancedSession[] {
    const sessionIds = this.userSessions.get(userKey);
    if (!sessionIds) return [];

    const sessions: EnhancedSession[] = [];
    for (const sessionId of sessionIds) {
      const session = this.get(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Invalidate all sessions for a user
   */
  invalidateUserSessions(userKey: string): number {
    const sessionIds = this.userSessions.get(userKey);
    if (!sessionIds) return 0;

    let count = 0;
    for (const sessionId of sessionIds) {
      this.delete(sessionId);
      count++;
    }

    return count;
  }

  /**
   * Enforce max concurrent sessions
   */
  enforceMaxConcurrentSessions(userKey: string): void {
    const sessions = this.getUserSessions(userKey);

    if (sessions.length > this.config.maxConcurrentSessions) {
      // Sort by last activity and delete oldest
      sessions.sort(
        (a, b) => a.metadata.lastActivityAt - b.metadata.lastActivityAt,
      );

      const toDelete = sessions.length - this.config.maxConcurrentSessions;
      for (let i = 0; i < toDelete; i++) {
        this.delete(sessions[i].id);
        logger.info(
          { userKey, sessionId: sessions[i].id },
          "Session deleted due to max concurrent sessions limit",
        );
      }
    }
  }

  /**
   * Clean up expired sessions
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      // Check if expired
      if (now > session.expiresAt) {
        this.delete(sessionId);
        cleaned++;
      }
      // Check if inactive
      else if (
        now - session.metadata.lastActivityAt >
        this.config.inactivityTimeoutMs
      ) {
        this.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug({ cleaned }, "Session cleanup completed");
    }
  }

  /**
   * Generate a session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${randomBytes(8).toString("hex")}`;
  }

  /**
   * Generate a transaction signing secret
   */
  private generateSecret(): string {
    return randomBytes(32).toString("hex");
  }

  /**
   * Destroy the session manager
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.sessions.clear();
    this.userSessions.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalSessions: number;
    expiredSessions: number;
    inactiveSessions: number;
    uniqueUsers: number;
  } {
    const now = Date.now();
    let expiredSessions = 0;
    let inactiveSessions = 0;

    for (const session of this.sessions.values()) {
      if (now > session.expiresAt) {
        expiredSessions++;
      } else if (
        now - session.metadata.lastActivityAt >
        this.config.inactivityTimeoutMs
      ) {
        inactiveSessions++;
      }
    }

    return {
      totalSessions: this.sessions.size,
      expiredSessions,
      inactiveSessions,
      uniqueUsers: this.userSessions.size,
    };
  }
}

// Export singleton instance
export const sessionManager = new SessionManager({
  sessionDurationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  inactivityTimeoutMs: 30 * 60 * 1000, // 30 minutes
  maxConcurrentSessions: 5,
});
