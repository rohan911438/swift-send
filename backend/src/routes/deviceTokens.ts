import { FastifyRequest, FastifyReply } from 'fastify';
import { deviceTokenService } from '../modules/notifications/deviceTokenService';
import { logger } from '../logger';

interface RegisterDeviceTokenRequest {
  token: string;
  platform: 'web' | 'ios' | 'android';
  metadata?: {
    model?: string;
    osVersion?: string;
    appVersion?: string;
  };
}

interface UnregisterDeviceTokenRequest {
  token: string;
}

export async function registerDeviceToken(
  request: FastifyRequest<{
    Body: RegisterDeviceTokenRequest;
  }>,
  reply: FastifyReply,
) {
  try {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { token, platform, metadata } = request.body;

    if (!token || !platform) {
      return reply.status(400).send({ error: 'Missing required fields: token, platform' });
    }

    const deviceToken = await deviceTokenService.registerDeviceToken(
      userId,
      token,
      platform,
      metadata,
    );

    logger.debug(`[registerDeviceToken] Registered device token for user: ${userId}`);
    return reply.status(201).send({
      id: deviceToken.id,
      platform: deviceToken.platform,
      createdAt: deviceToken.createdAt,
    });
  } catch (error) {
    logger.error({ err: error }, '[registerDeviceToken] Error');
    return reply.status(500).send({ error: 'Failed to register device token' });
  }
}

export async function unregisterDeviceToken(
  request: FastifyRequest<{
    Body: UnregisterDeviceTokenRequest;
  }>,
  reply: FastifyReply,
) {
  try {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { token } = request.body;
    if (!token) {
      return reply.status(400).send({ error: 'Missing required field: token' });
    }

    const success = await deviceTokenService.unregisterDeviceToken(token);

    if (!success) {
      return reply.status(404).send({ error: 'Device token not found' });
    }

    logger.debug(`[unregisterDeviceToken] Unregistered device token for user: ${userId}`);
    return reply.status(200).send({ message: 'Device token unregistered' });
  } catch (error) {
    logger.error({ err: error }, '[unregisterDeviceToken] Error');
    return reply.status(500).send({ error: 'Failed to unregister device token' });
  }
}

export async function listDeviceTokens(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const tokens = await deviceTokenService.getActiveDeviceTokens(userId);

    return reply.status(200).send({
      items: tokens.map((token) => ({
        id: token.id,
        platform: token.platform,
        model: token.model,
        osVersion: token.osVersion,
        appVersion: token.appVersion,
        createdAt: token.createdAt,
        lastUsedAt: token.lastUsedAt,
      })),
    });
  } catch (error) {
    logger.error({ err: error }, '[listDeviceTokens] Error');
    return reply.status(500).send({ error: 'Failed to list device tokens' });
  }
}
