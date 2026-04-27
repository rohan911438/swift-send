import { createClient, type RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from '../logger';

let client: RedisClientType | null = null;

export function createRedisClient(): RedisClientType | null {
  if (!config.cache.enabled || !config.cache.redisUrl) {
    return null;
  }
  if (client) {
    return client;
  }

  client = createClient({
    url: config.cache.redisUrl,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 50, 500),
    },
  });

  client.on('error', (error) => {
    logger.error({ err: error }, 'Redis client error');
  });

  return client;
}

export async function initRedisClient(): Promise<RedisClientType | null> {
  const redis = createRedisClient();
  if (!redis) {
    return null;
  }
  if (!redis.isOpen) {
    await redis.connect();
  }
  return redis;
}

export async function closeRedisClient(): Promise<void> {
  if (!client) {
    return;
  }
  try {
    if (client.isOpen) {
      await client.disconnect();
    }
  } catch (error) {
    logger.error({ err: error }, 'Error closing Redis client');
  } finally {
    client = null;
  }
}

export function getRedisClient(): RedisClientType | null {
  return client;
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  try {
    const payload = await redis.get(key);
    if (!payload) {
      return null;
    }
    return JSON.parse(payload) as T;
  } catch (error) {
    logger.warn({ err: error, key }, 'Redis read failed');
    return null;
  }
}

export async function setCachedJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  try {
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    logger.warn({ err: error, key }, 'Redis write failed');
  }
}

export async function deleteCachedKey(key: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  try {
    await redis.del(key);
  } catch (error) {
    logger.warn({ err: error, key }, 'Redis delete failed');
  }
}

export async function deleteCachedKeys(pattern: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  try {
    for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      await redis.del(key);
    }
  } catch (error) {
    logger.warn({ err: error, pattern }, 'Redis key scan/delete failed');
  }
}
