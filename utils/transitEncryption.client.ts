// Error codes for transit encryption
export const ERROR_CODES = {
  UNSUPPORTED_BROWSER: 'TRANSIT_UNSUPPORTED',
  KEY_GENERATION_FAILED: 'TRANSIT_KEY_GEN_FAILED',
  ENCRYPTION_FAILED: 'TRANSIT_ENCRYPT_FAILED',
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

// Interface for server public key response
interface ServerPublicKeyResponse {
  publicKey: string;
  algorithm: string;
  expiresAt: number;
}

// Session cache for server's public key
let serverPublicKeyCache: {
  key: CryptoKey;
  expiresAt: number;
} | null = null;

/**
 * Check if Web Crypto API is available in the browser
 */
export function isTransitEncryptionSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.crypto !== 'undefined' &&
    typeof window.crypto.subtle !== 'undefined'
  );
}

/**
 * Generate ephemeral ECDH key pair for a single encryption operation
 */
export async function generateEphemeralKeyPair(): Promise<CryptoKeyPair> {
  if (!isTransitEncryptionSupported()) {
    throw new TransitEncryptionError(
      'Web Crypto API is not supported in this browser',
      ERROR_CODES.UNSUPPORTED_BROWSER
    );
  }

  try {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey', 'deriveBits']
    );

    return keyPair;
  } catch (error) {
    throw new TransitEncryptionError(
      'Failed to generate ephemeral key pair',
      ERROR_CODES.KEY_GENERATION_FAILED
    );
  }
}

/**
 * Fetch and cache server's public key
 */
export async function getServerPublicKey(): Promise<CryptoKey> {
  if (!isTransitEncryptionSupported()) {
    throw new TransitEncryptionError(
      'Web Crypto API is not supported in this browser',
      ERROR_CODES.UNSUPPORTED_BROWSER
    );
  }

  const now = Date.now();

  // Return cached key if still valid
  if (serverPublicKeyCache && serverPublicKeyCache.expiresAt > now) {
    return serverPublicKeyCache.key;
  }

  try {
    // Fetch server's public key
    const response = await fetch('/api/transit-key');
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data: ServerPublicKeyResponse = await response.json();

    // Decode public key from base64
    const publicKeyBuffer = Uint8Array.from(atob(data.publicKey), c => c.charCodeAt(0));

    // Import server's public key
    const publicKey = await window.crypto.subtle.importKey(
      'raw',
      publicKeyBuffer,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      false,
      []
    );

    // Cache the key
    serverPublicKeyCache = {
      key: publicKey,
      expiresAt: data.expiresAt,
    };

    return publicKey;
  } catch (error) {
    throw new TransitEncryptionError(
      'Failed to fetch server public key',
      ERROR_CODES.SERVER_KEY_UNAVAILABLE
    );
  }
}

/**
 * Derive shared secret using ECDH and HKDF-SHA256
 */
export async function deriveSharedSecret(
  clientPrivateKey: CryptoKey,
  serverPublicKey: CryptoKey
): Promise<CryptoKey> {
  if (!isTransitEncryptionSupported()) {
    throw new TransitEncryptionError(
      'Web Crypto API is not supported in this browser',
      ERROR_CODES.UNSUPPORTED_BROWSER
    );
  }

  try {
    // Derive bits using ECDH
    const sharedBits = await window.crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: serverPublicKey,
      },
      clientPrivateKey,
      256
    );

    // Derive AES-GCM key using HKDF-SHA256
    const sharedKey = await window.crypto.subtle.importKey(
      'raw',
      sharedBits,
      'HKDF',
      false,
      ['deriveKey']
    );

    const aesKey = await window.crypto.subtle.deriveKey(
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
      ['encrypt']
    );

    return aesKey;
  } catch (error) {
    throw new TransitEncryptionError(
      'Failed to derive shared secret',
      ERROR_CODES.ENCRYPTION_FAILED
    );
  }
}

/**
 * Encrypt API key for transit using AES-GCM-256
 */
export async function encryptForTransit(apiKey: string): Promise<EncryptedPayload> {
  if (!isTransitEncryptionSupported()) {
    throw new TransitEncryptionError(
      'Web Crypto API is not supported in this browser',
      ERROR_CODES.UNSUPPORTED_BROWSER
    );
  }

  try {
    // Generate ephemeral key pair
    const clientKeyPair = await generateEphemeralKeyPair();

    // Get server's public key
    const serverPublicKey = await getServerPublicKey();

    // Derive shared secret
    const sharedSecret = await deriveSharedSecret(
      clientKeyPair.privateKey,
      serverPublicKey
    );

    // Generate random IV (12 bytes for AES-GCM)
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // Encode API key as bytes
    const apiKeyBytes = new TextEncoder().encode(apiKey);

    // Encrypt using AES-GCM
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      sharedSecret,
      apiKeyBytes
    );

    // AES-GCM returns ciphertext + auth tag combined
    const encryptedArray = new Uint8Array(encryptedBuffer);
    
    // Split ciphertext and auth tag (last 16 bytes are auth tag)
    const ciphertext = encryptedArray.slice(0, -16);
    const authTag = encryptedArray.slice(-16);

    // Export client's public key
    const clientPublicKeyBuffer = await window.crypto.subtle.exportKey(
      'raw',
      clientKeyPair.publicKey
    );

    // Convert to base64
    const encryptedDataBase64 = btoa(String.fromCharCode(...ciphertext));
    const clientPublicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(clientPublicKeyBuffer)));
    const ivBase64 = btoa(String.fromCharCode(...iv));
    const authTagBase64 = btoa(String.fromCharCode(...authTag));

    return {
      version: 'v1',
      encryptedData: encryptedDataBase64,
      clientPublicKey: clientPublicKeyBase64,
      iv: ivBase64,
      authTag: authTagBase64,
    };
  } catch (error) {
    if (error instanceof TransitEncryptionError) {
      throw error;
    }
    
    throw new TransitEncryptionError(
      'Failed to encrypt API key for transit',
      ERROR_CODES.ENCRYPTION_FAILED
    );
  }
}
