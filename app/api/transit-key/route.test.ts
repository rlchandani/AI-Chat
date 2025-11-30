import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('Transit Key API', () => {
  it('should return server public key', async () => {
    const response = await GET();
    
    expect(response).toBeDefined();
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    expect(data.publicKey).toBeDefined();
    expect(typeof data.publicKey).toBe('string');
    expect(data.publicKey.length).toBeGreaterThan(0);
    expect(data.algorithm).toBe('ECDH-P256');
    expect(data.expiresAt).toBeDefined();
    expect(typeof data.expiresAt).toBe('number');
    expect(data.expiresAt).toBeGreaterThan(Date.now());
  });

  it('should set appropriate cache headers', async () => {
    const response = await GET();
    
    const cacheControl = response.headers.get('Cache-Control');
    expect(cacheControl).toBe('public, max-age=3600');
  });
});
