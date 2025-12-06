import { describe, it, expect } from 'vitest';
import {
  getServerKeyPair,
  decryptFromTransit,
  isEncryptedPayload,
  TransitEncryptionError,
  type EncryptedPayload,
} from './transitEncryption.server';

describe('Transit Encryption Server', () => {
  describe('getServerKeyPair', () => {
    it('should generate a valid key pair', async () => {
      const keyPair = await getServerKeyPair();

      expect(keyPair).toBeDefined();
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(typeof keyPair.publicKey).toBe('string');
      expect(keyPair.publicKey.length).toBeGreaterThan(0);
    });

    it('should cache the key pair on subsequent calls', async () => {
      const keyPair1 = await getServerKeyPair();
      const keyPair2 = await getServerKeyPair();

      // Should return the same cached key
      expect(keyPair1.publicKey).toBe(keyPair2.publicKey);
    });
  });

  describe('isEncryptedPayload', () => {
    it('should return true for valid encrypted payload', () => {
      const validPayload: EncryptedPayload = {
        version: 'v1',
        encryptedData: 'base64data',
        clientPublicKey: 'base64key',
        iv: 'base64iv',
        authTag: 'base64tag',
      };

      expect(isEncryptedPayload(validPayload)).toBe(true);
    });

    it('should return false for plain string', () => {
      expect(isEncryptedPayload('plain-api-key')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isEncryptedPayload(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isEncryptedPayload(undefined)).toBe(false);
    });

    it('should return false for object missing required fields', () => {
      const invalidPayload = {
        version: 'v1',
        encryptedData: 'data',
        // missing other fields
      };

      expect(isEncryptedPayload(invalidPayload)).toBe(false);
    });
  });

  describe('decryptFromTransit', () => {
    it('should reject unsupported payload version', async () => {
      const invalidPayload = {
        version: 'v2',
        encryptedData: 'data',
        clientPublicKey: 'key',
        iv: 'iv',
        authTag: 'tag',
      } as EncryptedPayload;

      await expect(decryptFromTransit(invalidPayload)).rejects.toThrow(TransitEncryptionError);
      await expect(decryptFromTransit(invalidPayload)).rejects.toThrow('Unsupported payload version');
    });

    it('should reject invalid base64 data', async () => {
      const invalidPayload: EncryptedPayload = {
        version: 'v1',
        encryptedData: 'invalid!!!base64',
        clientPublicKey: 'invalid!!!base64',
        iv: 'invalid!!!base64',
        authTag: 'invalid!!!base64',
      };

      await expect(decryptFromTransit(invalidPayload)).rejects.toThrow();
    });
  });
});
