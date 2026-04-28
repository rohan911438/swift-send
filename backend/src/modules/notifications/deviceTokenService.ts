import { randomUUID } from 'crypto';
import { logger } from '../../logger';

interface DeviceToken {
  id: string;
  userId: string;
  token: string;
  platform: 'web' | 'ios' | 'android';
  model?: string;
  osVersion?: string;
  appVersion?: string;
  isActive: boolean;
  createdAt: Date;
  lastUsedAt: Date;
  updatedAt: Date;
}

/**
 * Device Token Service - manages FCM device tokens for push notifications.
 * In production, this would connect to a real database.
 * For now, it's an in-memory mock to demonstrate the pattern.
 */
export class DeviceTokenService {
  private tokens: Map<string, DeviceToken> = new Map();

  /**
   * Register or update a device token for a user.
   * If the token already exists, it updates the last_used_at timestamp and marks as active.
   */
  async registerDeviceToken(
    userId: string,
    fcmToken: string,
    platform: 'web' | 'ios' | 'android',
    metadata?: {
      model?: string;
      osVersion?: string;
      appVersion?: string;
    },
  ): Promise<DeviceToken> {
    const now = new Date();

    // Check if this token already exists (from any user)
    let existingToken: DeviceToken | undefined;
    for (const token of this.tokens.values()) {
      if (token.token === fcmToken) {
        existingToken = token;
        break;
      }
    }

    if (existingToken) {
      if (existingToken.userId !== userId) {
        // Token re-registered by a different user - update ownership
        logger.debug(
          `[DeviceTokenService] Token re-registered by different user. Old: ${existingToken.userId}, New: ${userId}`,
        );
      }
      // Update existing token
      existingToken.userId = userId;
      existingToken.isActive = true;
      existingToken.lastUsedAt = now;
      existingToken.updatedAt = now;
      existingToken.model = metadata?.model || existingToken.model;
      existingToken.osVersion = metadata?.osVersion || existingToken.osVersion;
      existingToken.appVersion = metadata?.appVersion || existingToken.appVersion;
      return existingToken;
    }

    // Create new token
    const newToken: DeviceToken = {
      id: randomUUID(),
      userId,
      token: fcmToken,
      platform,
      model: metadata?.model,
      osVersion: metadata?.osVersion,
      appVersion: metadata?.appVersion,
      isActive: true,
      createdAt: now,
      lastUsedAt: now,
      updatedAt: now,
    };

    this.tokens.set(newToken.id, newToken);
    logger.debug(
      `[DeviceTokenService] New device token registered for user ${userId} on platform ${platform}`,
    );
    return newToken;
  }

  /**
   * Unregister a device token.
   */
  async unregisterDeviceToken(fcmToken: string): Promise<boolean> {
    for (const [id, token] of this.tokens.entries()) {
      if (token.token === fcmToken) {
        this.tokens.delete(id);
        logger.debug(`[DeviceTokenService] Device token unregistered`);
        return true;
      }
    }
    return false;
  }

  /**
   * Get all active device tokens for a user.
   */
  async getActiveDeviceTokens(userId: string): Promise<DeviceToken[]> {
    return Array.from(this.tokens.values()).filter(
      (token) => token.userId === userId && token.isActive,
    );
  }

  /**
   * Get all active FCM tokens for a user (for sending notifications).
   */
  async getActiveTokenStrings(userId: string): Promise<string[]> {
    const tokens = await this.getActiveDeviceTokens(userId);
    return tokens.map((t) => t.token);
  }

  /**
   * Mark a device token as inactive (e.g., when uninstall is detected).
   */
  async deactivateDeviceToken(fcmToken: string): Promise<boolean> {
    for (const token of this.tokens.values()) {
      if (token.token === fcmToken) {
        token.isActive = false;
        token.updatedAt = new Date();
        logger.debug(`[DeviceTokenService] Device token deactivated`);
        return true;
      }
    }
    return false;
  }

  /**
   * Get device token details by token string.
   */
  async getDeviceTokenByToken(fcmToken: string): Promise<DeviceToken | undefined> {
    for (const token of this.tokens.values()) {
      if (token.token === fcmToken) {
        return token;
      }
    }
    return undefined;
  }
}

// Singleton instance
export const deviceTokenService = new DeviceTokenService();
