import { webcrypto } from 'crypto';

const crypto = webcrypto as unknown as Crypto;

// Error codes for transit encryption
export const ERROR_CODES = {
  KEY_GENERATION_FAILED: 'TRANSIT_KEY_GEN_FAILED',
  ENCRYPTION_FAILED: 'TRANSIT_ENCRYPT_FAILED',
  DECRYPTION_FAILED: 'TRANSIT_DECRYPT_FAILED',
  INVALID_PAYLOAD: 'TRANSIT_INVALID_PAYLOAD',
  AUTH_TAG_MISMATCH: 'TRANSIT_AUTH_FAILED',
  SERVER_KEY_UNAVAILABLE: 'TRANSIT_SERVER_KEY_UNAVAILABLE',
} as const;

// Custom error class for transit encryption
export class TransitEncryptionError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'TransitEncryptionError';
  }
}

// Interface for encrypted payload
export interface EncryptedPayload {
  version: string;
  encryptedData: string;
  clientPublicKey: string;
  iv: string;
  authTag: string;
}

// Server key pair cache
interface ServerKeyPairCache {
  publicKey: string;
  privateKey: CryptoKey;
  expiresAt: number;
}

let serverKeyPairCache: ServerKeyPairCache | null = null;
const KEY_ROTATION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Generate and cache server's ECDH key pair with 24-hour rotation
 */
export async function getServerKeyPair(): Promise<{
  publicKey: string;
  privateKey: CryptoKey;
}> {
  const now = Date.now();
  
  // Return cached key if still valid
  if (serverKeyPairCache && serverKeyPairCache.expiresAt > now) {
    return {
      publicKey: serverKeyPairCache.publicKey,
      privateKey: serverKeyPairCache.privateKey,
    };
  }

  try {
    // Generate new P-256 ECDH key pair
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey', 'deriveBits']
    );

    // Export public key as raw format
    const publicKeyBuffer = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const publicKeyBase64 = Buffer.from(publicKeyBuffer).toString('base64');

    // Cache the key pair
    serverKeyPairCache = {
      publicKey: publicKeyBase64,
      privateKey: keyPair.privateKey,
      expiresAt: now + KEY_ROTATION_INTERVAL,
    };

    return {
      publicKey: publicKeyBase64,
      privateKey: keyPair.privateKey,
    };
  } catch (error) {
    throw new TransitEncryptionError(
      'Failed to generate server key pair',
      ERROR_CODES.KEY_GENERATION_FAILED
    );
  }
}

/**
 * Derive shared secret using ECDH and HKDF-SHA256
 */
export async function deriveSharedSecret(
  clientPublicKeyBase64: string,
  serverPrivateKey: CryptoKey
): Promise<CryptoKey> {
  try {
    // Decode client's public key from base64
    const clientPublicKeyBuffer = Buffer.from(clientPublicKeyBase64, 'base64');

    // Import client's public key
    const clientPublicKey = await crypto.subtle.importKey(
      'raw',
      clientPublicKeyBuffer,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      false,
      []
    );

    // Derive bits using ECDH
    const sharedBits = await crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: clientPublicKey,
      },
      serverPrivateKey,
      256
    );

    // Derive AES-GCM key using HKDF-SHA256
    const sharedKey = await crypto.subtle.importKey(
      'raw',
      sharedBits,
      'HKDF',
      false,
      ['deriveKey']
    );

    const aesKey = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(0),
        info: new TextEncoder().encode('api-key-transit-encryption'),
      },
      sharedKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['decrypt']
    );

    return aesKey;
  } catch (error) {
    throw new TransitEncryptionError(
      'Failed to derive shared secret',
      ERROR_CODES.DECRYPTION_FAILED
    );
  }
}

/**
 * Decrypt API key from transit payload using AES-GCM-256
 */
export async function decryptFromTransit(
  payload: EncryptedPayload
): Promise<string> {
  try {
    // Validate payload version
    if (payload.version !== 'v1') {
      throw new TransitEncryptionError(
        'Unsupported payload version',
        ERROR_CODES.INVALID_PAYLOAD
      );
    }

    // Get server's key pair
    const { privateKey } = await getServerKeyPair();

    // Derive shared secret
    const sharedSecret = await deriveSharedSecret(
      payload.clientPublicKey,
      privateKey
    );

    // Decode encrypted data, IV, and auth tag from base64
    const encryptedDataBuffer = Buffer.from(payload.encryptedData, 'base64');
    const ivBuffer = Buffer.from(payload.iv, 'base64');
    const authTagBuffer = Buffer.from(payload.authTag, 'base64');

    // Combine ciphertext and auth tag for AES-GCM
    const ciphertextWithTag = new Uint8Array(
      encryptedDataBuffer.length + authTagBuffer.length
    );
    ciphertextWithTag.set(encryptedDataBuffer, 0);
    ciphertextWithTag.set(authTagBuffer, encryptedDataBuffer.length);

    // Decrypt using AES-GCM
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer,
      },
      sharedSecret,
      ciphertextWithTag
    );

    // Convert decrypted buffer to string
    const decryptedApiKey = new TextDecoder().decode(decryptedBuffer);

    return decryptedApiKey;
  } catch (error) {
    if (error instanceof TransitEncryptionError) {
      throw error;
    }
    
    // Check if it's an authentication error
    if (error instanceof Error && error.message.includes('authentication')) {
      throw new TransitEncryptionError(
        'Authentication tag verification failed - data may have been tampered with',
        ERROR_CODES.AUTH_TAG_MISMATCH
      );
    }

    throw new TransitEncryptionError(
      'Failed to decrypt API key from transit',
      ERROR_CODES.DECRYPTION_FAILED
    );
  }
}

/**
 * Type guard to check if a value is an encrypted payload
 */
export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.version === 'string' &&
    typeof payload.encryptedData === 'string' &&
    typeof payload.clientPublicKey === 'string' &&
    typeof payload.iv === 'string' &&
    typeof payload.authTag === 'string'
  );
}
