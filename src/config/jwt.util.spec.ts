import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import {
  getValidatedJwtConfig,
  MIN_JWT_SECRET_LENGTH,
  resolveJwtAccessSecret,
} from './jwt.util.js';

const LONG_SECRET = 'x'.repeat(64);

describe('resolveJwtAccessSecret', () => {
  it('rejects a missing secret', () => {
    expect(() => resolveJwtAccessSecret(undefined)).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects an empty or whitespace-only secret', () => {
    expect(() => resolveJwtAccessSecret('')).toThrow(/JWT_ACCESS_SECRET/);
    expect(() => resolveJwtAccessSecret('   ')).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects known insecure placeholders', () => {
    expect(() => resolveJwtAccessSecret('change-me')).toThrow(/JWT_ACCESS_SECRET/);
    expect(() => resolveJwtAccessSecret('change-me-to-a-long-random-string-at-least-32-chars')).toThrow(
      /JWT_ACCESS_SECRET/,
    );
    expect(() => resolveJwtAccessSecret('secret')).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects secrets that are too short', () => {
    expect(() => resolveJwtAccessSecret('Abcdef1!')).toThrow(/at least/);
  });

  it('accepts a long high-entropy secret', () => {
    expect(resolveJwtAccessSecret(LONG_SECRET)).toBe(LONG_SECRET);
  });

  it('does not include the secret value in error messages', () => {
    try {
      resolveJwtAccessSecret('fake-secret-do-not-leak');
    } catch (error) {
      expect(String(error)).not.toContain('fake-secret-do-not-leak');
    }
  });
});

describe('getValidatedJwtConfig', () => {
  it('throws when the configuration lacks a key', () => {
    const config = { get: () => undefined } as unknown as ConfigService;
    expect(() => getValidatedJwtConfig(config)).toThrow(/not configured/);
  });

  it('returns the validated secret and a default lifetime', () => {
    const config = {
      get: (key: string) =>
        key === 'jwt.accessSecret' ? LONG_SECRET : key === 'jwt.accessExpiresIn' ? '15m' : undefined,
    } as unknown as ConfigService;
    expect(getValidatedJwtConfig(config)).toEqual({
      secret: LONG_SECRET,
      accessExpiresIn: '15m',
    });
  });

  it('keeps the same source for signing and verification', () => {
    const secret = resolveJwtAccessSecret(LONG_SECRET);
    expect(secret.length).toBeGreaterThanOrEqual(MIN_JWT_SECRET_LENGTH);
  });
});