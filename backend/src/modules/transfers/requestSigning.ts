import { createHmac, timingSafeEqual } from 'node:crypto';
import { ValidationError } from '../../errors';

type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike };

function sortValue(value: JsonLike): JsonLike {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, JsonLike>>((accumulator, key) => {
        const nestedValue = (value as Record<string, JsonLike>)[key];
        if (nestedValue !== undefined) {
          accumulator[key] = sortValue(nestedValue);
        }
        return accumulator;
      }, {});
  }

  return value;
}

export function canonicalizeSignedTransferPayload(payload: Record<string, unknown>): string {
  return JSON.stringify(sortValue(payload as JsonLike));
}

function signCanonicalPayload(payload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(payload).digest();
}

export function verifySignedTransferPayload(payload: Record<string, unknown>, signature: string | undefined, secret: string): void {
  if (!signature) {
    throw new ValidationError('transaction signature is required');
  }

  const providedSignature = Buffer.from(signature, 'hex');
  const expectedSignature = signCanonicalPayload(canonicalizeSignedTransferPayload(payload), secret);

  if (providedSignature.length !== expectedSignature.length || !timingSafeEqual(providedSignature, expectedSignature)) {
    throw new ValidationError('invalid transaction signature');
  }
}