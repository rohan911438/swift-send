import { 
  canonicalizeSignedTransferPayload, 
  verifySignedTransferPayload,
  sortValue 
} from '../requestSigning';

describe('Request Signing', () => {
  describe('sortValue', () => {
    it('should sort object keys recursively', () => {
      const input = {
        z: 'last',
        a: 'first',
        m: {
          z_nested: 'nested_last',
          a_nested: 'nested_first',
        },
      };

      const result = sortValue(input);
      const keys = Object.keys(result as Record<string, unknown>);
      
      expect(keys).toEqual(['a', 'm', 'z']);
      
      const nestedKeys = Object.keys((result as any).m);
      expect(nestedKeys).toEqual(['a_nested', 'z_nested']);
    });

    it('should handle arrays correctly', () => {
      const input = ['c', 'a', 'b'];
      const result = sortValue(input);
      
      expect(result).toEqual(['c', 'a', 'b']); // Arrays maintain order
    });

    it('should handle nested arrays and objects', () => {
      const input = {
        items: [
          { z: 1, a: 2 },
          { b: 3, a: 4 },
        ],
        metadata: {
          tags: ['tag1', 'tag2'],
          z_field: 'last',
          a_field: 'first',
        },
      };

      const result = sortValue(input as any) as any;
      
      expect(Object.keys(result)).toEqual(['items', 'metadata']);
      expect(Object.keys(result.metadata)).toEqual(['a_field', 'tags', 'z_field']);
      expect(Object.keys(result.items[0])).toEqual(['a', 'z']);
      expect(Object.keys(result.items[1])).toEqual(['a', 'b']);
    });

    it('should handle primitive values', () => {
      expect(sortValue('string')).toBe('string');
      expect(sortValue(123)).toBe(123);
      expect(sortValue(true)).toBe(true);
      expect(sortValue(null)).toBe(null);
    });
  });

  describe('canonicalizeSignedTransferPayload', () => {
    it('should create consistent canonical strings', () => {
      const payload1 = {
        amount: 100,
        currency: 'USDC',
        recipient: {
          type: 'wallet',
          wallet_public_key: 'GTEST...',
        },
        user_id: 'user-1',
      };

      const payload2 = {
        user_id: 'user-1',
        recipient: {
          wallet_public_key: 'GTEST...',
          type: 'wallet',
        },
        currency: 'USDC',
        amount: 100,
      };

      const canonical1 = canonicalizeSignedTransferPayload(payload1);
      const canonical2 = canonicalizeSignedTransferPayload(payload2);

      expect(canonical1).toBe(canonical2);
    });

    it('should exclude signature field from canonicalization', () => {
      const payload = {
        amount: 100,
        currency: 'USDC',
        signature: 'should-be-excluded',
        user_id: 'user-1',
      };

      const canonical = canonicalizeSignedTransferPayload(payload);
      expect(canonical).not.toContain('signature');
      expect(canonical).not.toContain('should-be-excluded');
    });

    it('should handle complex nested structures', () => {
      const payload = {
        amount: 100,
        currency: 'USDC',
        recipient: {
          type: 'cash_pickup',
          country: 'US',
          metadata: {
            location: 'New York',
            partner: 'MoneyGram',
          },
        },
        metadata: {
          note: 'Family support',
          category: 'personal',
        },
      };

      const canonical = canonicalizeSignedTransferPayload(payload);
      const parsed = JSON.parse(canonical);

      // Verify structure is sorted
      expect(Object.keys(parsed)).toEqual([
        'amount',
        'currency',
        'metadata',
        'recipient',
      ]);

      expect(Object.keys(parsed.recipient)).toEqual([
        'country',
        'metadata',
        'type',
      ]);
    });
  });

  describe('verifySignedTransferPayload', () => {
    const testSecret = 'test-secret-key';

    it('should verify valid signatures', () => {
      const payload = {
        amount: 100,
        currency: 'USDC',
        user_id: 'user-1',
      };

      // Create a valid signature
      const canonical = canonicalizeSignedTransferPayload(payload);
      const crypto = require('crypto');
      const validSignature = crypto
        .createHmac('sha256', testSecret)
        .update(canonical)
        .digest('hex');

      expect(() => {
        verifySignedTransferPayload(payload, validSignature, testSecret);
      }).not.toThrow();
    });

    it('should reject invalid signatures', () => {
      const payload = {
        amount: 100,
        currency: 'USDC',
        user_id: 'user-1',
      };

      const invalidSignature = 'invalid-signature';

      expect(() => {
        verifySignedTransferPayload(payload, invalidSignature, testSecret);
      }).toThrow('invalid transaction signature');
    });

    it('should reject missing signatures', () => {
      const payload = {
        amount: 100,
        currency: 'USDC',
        user_id: 'user-1',
      };

      expect(() => {
        verifySignedTransferPayload(payload, undefined, testSecret);
      }).toThrow('transaction signature is required');
    });

    it('should reject tampered payloads', () => {
      const originalPayload = {
        amount: 100,
        currency: 'USDC',
        user_id: 'user-1',
      };

      // Create signature for original payload
      const canonical = canonicalizeSignedTransferPayload(originalPayload);
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', testSecret)
        .update(canonical)
        .digest('hex');

      // Tamper with the payload
      const tamperedPayload = {
        ...originalPayload,
        amount: 1000, // Changed amount
      };

      expect(() => {
        verifySignedTransferPayload(tamperedPayload, signature, testSecret);
      }).toThrow('invalid transaction signature');
    });

    it('should handle payloads with signature field', () => {
      const payload = {
        amount: 100,
        currency: 'USDC',
        user_id: 'user-1',
        signature: 'existing-signature', // Should be ignored
      };

      // Create signature for payload without signature field
      const payloadWithoutSignature = { ...payload };
      delete (payloadWithoutSignature as any).signature;
      const canonical = canonicalizeSignedTransferPayload(payloadWithoutSignature);
      const crypto = require('crypto');
      const validSignature = crypto
        .createHmac('sha256', testSecret)
        .update(canonical)
        .digest('hex');

      expect(() => {
        verifySignedTransferPayload(payload, validSignature, testSecret);
      }).not.toThrow();
    });
  });
});