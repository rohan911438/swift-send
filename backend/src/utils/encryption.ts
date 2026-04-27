import crypto from 'crypto';
import { config, isProd } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function normalizeKey(rawKey: string): Buffer {
  const asBuffer = Buffer.from(rawKey, 'utf-8');
  if (asBuffer.length === KEY_LENGTH) return asBuffer;
  if (asBuffer.length > KEY_LENGTH) return asBuffer.slice(0, KEY_LENGTH);
  return crypto.createHash('sha256').update(asBuffer).digest();
}

function getEncryptionKey(): Buffer {
  const rawKey = config.encryption.key;
  if (!rawKey || rawKey.includes('dev-only-change-me-in-production')) {
    if (isProd()) {
      throw new Error('DATA_ENCRYPTION_KEY must be set in production for PII at-rest encryption.');
    }
  }
  return normalizeKey(rawKey);
}

export function encryptString(value: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptString(value: string): string {
  const buffer = Buffer.from(value, 'base64');
  if (buffer.length < IV_LENGTH + 16) {
    throw new Error('Invalid encrypted payload');
  }
  const iv = buffer.slice(0, IV_LENGTH);
  const authTag = buffer.slice(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = buffer.slice(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function transformEncryptedFields<T extends object>(
  source: T,
  fields: Array<keyof T>,
  transformFn: (value: string) => string,
): T {
  return fields.reduce((acc, field) => {
    const value = acc[field];
    if (typeof value === 'string' && value.length > 0) {
      return {
        ...acc,
        [field]: transformFn(value),
      };
    }
    return acc;
  }, source);
}
