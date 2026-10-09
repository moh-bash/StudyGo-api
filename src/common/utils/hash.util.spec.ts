import { describe, expect, it } from 'vitest';
import { generateOpaqueToken, sha256 } from './hash.util.js';

describe('sha256', () => {
  it('produces a stable 64-char hex digest', () => {
    const digest = sha256('abc');
    expect(digest).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(sha256('abc')).toBe(digest);
  });

  it('produces different digests for different inputs', () => {
    expect(sha256('a')).not.toBe(sha256('b'));
  });
});

describe('generateOpaqueToken', () => {
  it('generates a high-entropy hex token with the requested byte size', () => {
    const token = generateOpaqueToken();
    expect(token).toMatch(/^[0-9a-f]{96}$/);
    expect(generateOpaqueToken(16)).toMatch(/^[0-9a-f]{32}$/);
  });

  it('generates unique tokens', () => {
    expect(generateOpaqueToken()).not.toBe(generateOpaqueToken());
  });
});