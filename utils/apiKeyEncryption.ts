/**
 * API Key Encryption Utilities
 * 
 * Uses Web Crypto API for secure encryption/decryption of API keys.
 * Keys are encrypted with a user-provided PIN before being stored in localStorage.
 */

const SALT_KEY = 'api-key-salt';

const LEGACY_PREFIX = 'iv:';
const V1_PREFIX = 'v1:';

/**
 * Generate a cryptographic key from a PIN using PBKDF2
 */
async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const pinBuffer = encoder.encode(pin);

    // Import PIN as raw key material
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        pinBuffer,
        'PBKDF2',
        false,
        ['deriveKey']
    );

    // Derive a 256-bit AES-GCM key
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt as any,
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Get or create a salt for key derivation
 */
function getSalt(): Uint8Array {
    if (typeof window === 'undefined') {
        return new Uint8Array(16);
    }

    const storedSalt = localStorage.getItem(SALT_KEY);
    if (storedSalt) {
        return Uint8Array.from(atob(storedSalt), c => c.charCodeAt(0));
    }

    // Generate new salt
    const salt = crypto.getRandomValues(new Uint8Array(16));
    localStorage.setItem(SALT_KEY, btoa(String.fromCharCode(...salt)));
    return salt;
}

/**
 * Encrypt an API key with a PIN
 */
export async function encryptApiKey(apiKey: string, pin: string): Promise<string> {
    if (!apiKey) return '';

    // Generate a fresh salt for each encryption (more secure than global salt)
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(pin, salt);

    // Generate random IV for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);

    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as any },
        key,
        data as any
    );

    // Combine Salt + IV + encrypted data and encode as base64
    // Layout: [Salt (16)][IV (12)][Ciphertext (variable)]
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);

    return V1_PREFIX + btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt an API key with a PIN
 */
export async function decryptApiKey(encryptedKey: string, pin: string): Promise<string> {
    if (!encryptedKey) return encryptedKey;

    try {
        let salt: Uint8Array;
        let iv: Uint8Array;
        let data: Uint8Array;

        if (encryptedKey.startsWith(V1_PREFIX)) {
            // New format: v1:base64(salt + iv + ciphertext)
            const combined = Uint8Array.from(
                atob(encryptedKey.slice(V1_PREFIX.length)),
                c => c.charCodeAt(0)
            );

            // Extract components
            salt = combined.slice(0, 16);
            iv = combined.slice(16, 28);
            data = combined.slice(28);
        } else if (encryptedKey.startsWith(LEGACY_PREFIX)) {
            // Legacy format: iv:base64(iv + ciphertext) - uses global salt
            salt = getSalt();

            const combined = Uint8Array.from(
                atob(encryptedKey.slice(LEGACY_PREFIX.length)),
                c => c.charCodeAt(0)
            );

            iv = combined.slice(0, 12);
            data = combined.slice(12);
        } else {
            // Not encrypted
            return encryptedKey;
        }

        const key = await deriveKey(pin, salt);

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv as any },
            key,
            data as any
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    } catch (error) {
        // Decryption failed (likely wrong PIN)
        throw new Error('Invalid PIN or corrupted data');
    }
}

/**
 * Check if a string is encrypted
 */
export function isEncrypted(value: string): boolean {
    return value.startsWith(V1_PREFIX) || value.startsWith(LEGACY_PREFIX);
}



/**
 * In-memory storage for decrypted keys (cleared on reload/close)
 */
const decryptedKeys = new Map<string, string>();

export function setSessionKey(keyType: string, value: string): void {
    if (value) {
        decryptedKeys.set(keyType, value);
    } else {
        decryptedKeys.delete(keyType);
    }
}

export function getSessionKey(keyType: string): string | null {
    return decryptedKeys.get(keyType) || null;
}

export function clearSessionKeys(): void {
    decryptedKeys.clear();
}

export function hasSessionKeys(): boolean {
    return decryptedKeys.size > 0;
}


