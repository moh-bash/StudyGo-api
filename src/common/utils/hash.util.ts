import { createHash, randomBytes } from 'node:crypto';

/** Generates a high-entropy opaque token (hex). Used for refresh/reset tokens. */
export function generateOpaqueToken(bytes = 48): string {
  return randomBytes(bytes).toString('hex');
}

/** SHA-256 hex digest. Stored token hashes are never reversible to the token. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
