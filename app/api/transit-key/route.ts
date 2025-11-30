import { NextResponse } from 'next/server';
import { getServerKeyPair } from '@/utils/transitEncryption.server';

/**
 * GET /api/transit-key
 * 
 * Returns the server's public key for transit encryption.
 * Clients use this key to encrypt API keys before transmission.
 * 
 * Response includes:
 * - publicKey: Base64-encoded P-256 public key
 * - algorithm: Algorithm identifier for client validation
 * - expiresAt: Unix timestamp when key will rotate
 * 
 * Cache-Control header allows clients to cache for 1 hour.
 */
export async function GET() {
  try {
    const { publicKey } = await getServerKeyPair();
    
    // Calculate expiration timestamp (24 hours from now)
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000);

    const response = NextResponse.json({
      publicKey,
      algorithm: 'ECDH-P256',
      expiresAt,
    });

    // Set cache headers to allow client-side caching for 1 hour
    response.headers.set('Cache-Control', 'public, max-age=3600');

    return response;
  } catch (error) {
    console.error('Failed to get server public key:', error);
    
    return NextResponse.json(
      { error: 'Failed to retrieve server public key' },
      { status: 500 }
    );
  }
}
